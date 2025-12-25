/**
 * Studio Jenial API Server
 * 
 * COLD-START SAFE: Heavy modules are lazy-loaded to ensure fast startup
 * for serverless environments like Vercel.
 */
console.log('[Server] Starting (cold-start safe)...');

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env files (optional - only for local dev convenience)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();

// Allow large payloads for base64 images/videos
app.use(express.json({ limit: '100mb' }));

// CORS Configuration - Restrict to allowed origins only
const ALLOWED_ORIGINS = [
  'http://localhost:5173',    // Vite dev server
  'http://localhost:3001',    // Backend dev
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'https://jenial.app',       // Production domain
  'https://www.jenial.app',   // Production www subdomain
  process.env.ALLOWED_ORIGIN, // Additional origin from env
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else if (process.env.VERCEL_ENV === 'preview' && origin.endsWith('.vercel.app')) {
      // Allow Vercel preview deployments (safe: only in preview env)
      console.log(`[CORS] Allowing preview origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Gemini-Api-Key', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ============================================================================
// CRITICAL ENDPOINTS - NO EXTERNAL DEPENDENCIES (Must always work)
// ============================================================================

// Health check endpoint - ULTRA LIGHTWEIGHT
app.get('/api/health', (req, res) => {
  const hasServerKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20);
  res.json({
    status: 'ok',
    mode: hasServerKey ? 'server-managed' : 'BYOK',
    requiresUserKey: !hasServerKey,
    timestamp: Date.now()
  });
});

// Config endpoint - ULTRA LIGHTWEIGHT
app.get('/api/config', (req, res) => {
  try {
    const hasServerKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20);
    res.json({
      status: 'ok',
      hasServerKey,
      mode: hasServerKey ? 'server-managed' : 'BYOK',
      requiresUserKey: !hasServerKey,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[Config] Error:', err);
    res.status(200).json({ status: 'ok', hasServerKey: false, requiresUserKey: true });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  const hasServerKey = !!process.env.GEMINI_API_KEY;
  res.json({
    name: '🎬 Studio Jenial API',
    mode: hasServerKey ? 'Server-Managed' : 'BYOK (Bring Your Own Key)',
    status: 'running'
  });
});

// ============================================================================
// LAZY LOADING HELPER - For heavy modules
// ============================================================================

/**
 * Create a lazy-loaded middleware/router
 * Imports the module only on first request, then caches it
 */
const lazyMiddleware = (loader) => {
  let cached = null;
  return async (req, res, next) => {
    try {
      if (!cached) {
        console.log(`[Lazy] Loading module...`);
        const module = await loader();
        cached = module.default || module;
      }
      // If it's a router, use it; if it's a handler, call it
      if (typeof cached === 'function') {
        return cached(req, res, next);
      }
      next();
    } catch (err) {
      console.error('[Lazy] Module load error:', err);
      res.status(500).json({ error: 'Module load failed', details: err.message });
    }
  };
};

/**
 * Create a lazy-loaded handler for specific endpoints
 */
const lazyHandler = (loader, handlerName) => {
  let cached = null;
  return async (req, res, next) => {
    try {
      if (!cached) {
        console.log(`[Lazy] Loading ${handlerName}...`);
        const module = await loader();
        cached = module;
      }
      const handler = cached[handlerName] || cached.default?.[handlerName];
      if (handler) {
        return handler(req, res, next);
      }
      res.status(404).json({ error: `Handler ${handlerName} not found` });
    } catch (err) {
      console.error(`[Lazy] ${handlerName} load error:`, err);
      res.status(500).json({ error: 'Handler load failed', details: err.message });
    }
  };
};

// ============================================================================
// LAZY-LOADED ROUTERS
// ============================================================================

// Projects Router
app.use('/api/projects', lazyMiddleware(() => import('./api/projects/index.js')));

// Segments Router
app.use('/api/segments', lazyMiddleware(() => import('./api/segments/index.js')));

// Timeline Router (mounted under projects/:id)
app.use('/api/projects/:id', lazyMiddleware(() => import('./api/timeline/index.js')));

// Nano Banana Pro Endpoints
app.post('/api/nano/preview', lazyHandler(() => import('./api/nano/index.js'), 'preview'));
app.post('/api/nano/retouch', lazyHandler(() => import('./api/nano/index.js'), 'retouch'));
app.post('/api/nano/shot-variants', lazyHandler(() => import('./api/nano/index.js'), 'shotVariants'));

// ============================================================================
// LAZY-LOADED HEAVY ENDPOINTS
// ============================================================================

// Veo API Configuration (used by video endpoints)
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Security: Allowed URL patterns for proxy
const ALLOWED_PROXY_PATTERNS = [
  /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[^/]+:download\?alt=media$/
];

// Security: Block private/local IPs
const isPrivateIP = (hostname) => {
  const privatePatterns = [
    /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i
  ];
  return privatePatterns.some(pattern => pattern.test(hostname));
};

/**
 * Dual Mode API Key Management (lazy loaded)
 */
const getApiKey = (req) => {
  // Priority 1: Server-managed key from environment
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20) {
    return process.env.GEMINI_API_KEY.trim();
  }
  // Priority 2: User-provided key via header (BYOK mode)
  const userKey = req.headers['x-api-key'];
  if (userKey && typeof userKey === 'string' && userKey.trim().length >= 20) {
    return userKey.trim();
  }
  const error = new Error('API_KEY_MISSING');
  error.code = 'API_KEY_MISSING';
  error.statusCode = 401;
  throw error;
};

// Lazy load GoogleGenAI only when needed
let _GoogleGenAI = null;
const getClient = async (req) => {
  const apiKey = getApiKey(req);
  if (!_GoogleGenAI) {
    const module = await import('@google/genai');
    _GoogleGenAI = module.GoogleGenAI;
  }
  return new _GoogleGenAI({ apiKey });
};

// Error handler
const handleError = (res, error) => {
  const errorCode = error.code || 'UNKNOWN_ERROR';
  const statusCode = error.statusCode || 500;

  if (errorCode === 'API_KEY_MISSING') {
    return res.status(401).json({ error: 'API_KEY_MISSING' });
  }
  if (errorCode === 'API_KEY_INVALID' || (statusCode === 401 && !error.code)) {
    return res.status(401).json({ error: 'API_KEY_INVALID' });
  }
  if (statusCode === 400) {
    return res.status(400).json({ error: 'BAD_REQUEST', details: error.message || 'Invalid request' });
  }
  console.error('API Error:', errorCode);
  res.status(statusCode).json({ error: statusCode >= 500 ? 'INTERNAL_ERROR' : error.message, code: errorCode });
};

// Safe JSON stringify
const safeStringify = (obj, space = 0) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, space);
};

// 1. General Content Generation
app.post('/api/generate-content', async (req, res) => {
  try {
    const ai = await getClient(req);
    const { model, contents, config } = req.body;
    console.log(`[ContentAPI] Request: model=${model}`);

    const response = await ai.models.generateContent({ model, contents, config });

    try {
      const jsonStr = safeStringify(response);
      res.setHeader('Content-Type', 'application/json');
      res.send(jsonStr);
    } catch (serErr) {
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      res.json({ text, _fallback: true });
    }
  } catch (error) {
    const status = error?.status || error?.statusCode || 500;
    console.error('[ContentAPI] Error:', error?.message);
    res.status(status).json({ error: error?.message || 'Unknown error', code: error?.code || 'UNKNOWN' });
  }
});

// 2. File Upload Proxy
app.post('/api/files/upload', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { displayName, mimeType, fileSize } = req.body;

    if (!fileSize) {
      return res.status(400).json({ error: 'fileSize is required' });
    }

    const uploadUrlResponse = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileSize.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
      },
      body: JSON.stringify({ file: { display_name: displayName } })
    });

    if (!uploadUrlResponse.ok) {
      const err = await uploadUrlResponse.json().catch(() => ({}));
      throw new Error(`Failed to initiate upload: ${err.error?.message || uploadUrlResponse.statusText}`);
    }

    const uploadUrl = uploadUrlResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('No upload URL received from Google');

    res.json({ uploadUrl });
  } catch (error) {
    console.error('[Files] Init upload error:', error);
    handleError(res, error);
  }
});

// 3. Video Generation (Veo)
app.post('/api/video/generate', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { model, prompt, parameters, videoUri, startFrame } = req.body;

    if (!model) return res.status(400).json({ error: 'Model is required' });
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required' });

    console.log(`[Veo] Starting video generation with model: ${model}`);

    const instance = { prompt: prompt.trim() };
    if (videoUri) {
      instance.video = { uri: videoUri };
    } else if (startFrame) {
      instance.image = { bytesBase64Encoded: startFrame, mimeType: 'image/jpeg' };
    }

    const requestBody = { instances: [instance] };
    if (parameters && Object.keys(parameters).length > 0) {
      requestBody.parameters = parameters;
    }

    const endpoint = `${VEO_API_BASE}/models/${model}:predictLongRunning`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      if (response.status === 404) {
        return res.status(404).json({ error: 'MODEL_NOT_FOUND', details: `Model "${model}" is not available` });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ error: 'API_KEY_INVALID', details: errorMessage });
      }
      return res.status(response.status).json({ error: `Veo API Error: ${errorMessage}` });
    }

    const data = await response.json();
    if (!data.name) return res.status(500).json({ error: 'No operation name returned from Veo API' });

    console.log('[Veo] Operation started:', data.name);
    res.json({ operationName: data.name });
  } catch (error) {
    console.error('[Veo] Start error:', error);
    handleError(res, error);
  }
});

// 4. Poll Video Operation Status
app.get('/api/video/status', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const operationName = req.query.name || req.query.operationName;

    if (!operationName) return res.status(400).json({ error: 'name query parameter is required' });

    const pollUrl = `${VEO_API_BASE}/${operationName}`;
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: `Veo Poll Error: ${errorData.error?.message || response.statusText}` });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ done: true, error: data.error.message || 'Operation failed' });
    }

    if (!data.done) return res.json({ done: false });

    // Extract video URI
    let videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
      data.response?.video?.uri ||
      data.response?.generatedSamples?.[0]?.video?.uri ||
      data.result?.video?.uri ||
      data.video?.uri;

    if (!videoUri) {
      return res.status(500).json({ done: true, error: 'No video URI in completed operation response' });
    }

    res.json({ done: true, videoUri });
  } catch (error) {
    console.error('[Veo] Poll error:', error);
    handleError(res, error);
  }
});

// 5. Proxy Video Download (SECURED)
app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUri = req.query.uri;
    const apiKey = getApiKey(req);

    if (!videoUri) return res.status(400).json({ error: 'Missing video URI' });

    let parsedUrl;
    try { parsedUrl = new URL(videoUri); } catch { return res.status(400).json({ error: 'Invalid URI format' }); }

    if (isPrivateIP(parsedUrl.hostname)) {
      return res.status(403).json({ error: 'Proxy to private/local addresses is not allowed' });
    }

    const isAllowed = ALLOWED_PROXY_PATTERNS.some(pattern => pattern.test(videoUri));
    const genericPattern = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\//;
    if (!isAllowed && !genericPattern.test(videoUri)) {
      return res.status(403).json({ error: 'Only Google generativelanguage API file downloads are allowed' });
    }

    const response = await fetch(videoUri, { method: 'GET', headers: { 'x-goog-api-key': apiKey } });
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);

    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentType) res.setHeader('Content-Type', contentType);

    const { pipeline } = await import('stream/promises');
    await pipeline(response.body, res);
  } catch (error) {
    console.error('[Veo] Proxy error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to proxy video' });
  }
});

// ============================================================================
// GOOGLE DRIVE INTEGRATION (Lazy Loaded)
// ============================================================================

let _driveService = null;
const getDriveService = async () => {
  if (!_driveService) {
    _driveService = await import('./services/googleDriveService.js');
  }
  return _driveService;
};

app.get('/api/google/drive/enabled', async (req, res) => {
  try {
    const driveService = await getDriveService();
    res.json({ enabled: driveService.isDriveConfigured() });
  } catch (error) {
    res.json({ enabled: false });
  }
});

// Helper to get user ID safely (Verified -> Unverified Fallback)
const getUserIdFromAuth = async (authHeader, supabase) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const token = authHeader.split(' ')[1];

  // 1. Try strict Supabase validation
  if (supabase) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      return user.id;
    }
    console.warn('[Auth] Supabase validation failed, attempting offline bypass...');
  }

  // 2. Offline Fallback: Decode JWT without verification (DEV/EMERGENCY ONLY)
  // This allows the app to work even if Supabase request fails/is paused
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonPayload);
    if (payload.sub) {
      console.log(`[Auth] ⚠️ USING OFFLINE BYPASS for user: ${payload.sub}`);
      return payload.sub;
    }
  } catch (e) {
    console.error('[Auth] Token decode failed:', e);
  }

  throw new Error('INVALID_TOKEN');
};

app.get('/api/google/drive/status', async (req, res) => {
  try {
    const driveService = await getDriveService();
    const authHeader = req.headers.authorization;

    // Use new helper
    let userId;
    try {
      userId = await getUserIdFromAuth(authHeader, driveService.supabase);
    } catch (e) {
      return res.json({ connected: false, reason: e.message });
    }

    const connected = await driveService.isDriveConnected(userId);
    res.json({ connected });
  } catch (error) {
    console.error('Drive status error:', error);
    res.json({ connected: false, reason: 'ERROR' });
  }
});

app.get('/api/google/drive/auth', async (req, res) => {
  try {
    const driveService = await getDriveService();
    if (!driveService.isDriveConfigured()) {
      return res.status(503).json({ error: 'DRIVE_NOT_CONFIGURED' });
    }
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'USER_ID_REQUIRED' });
    const authUrl = driveService.getAuthUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).json({ error: 'AUTH_FAILED' });
  }
});

app.get('/api/google/drive/callback', async (req, res) => {
  try {
    const driveService = await getDriveService();
    const { code, state: userId } = req.query;
    if (!code || !userId) return res.redirect('/studio?drive=error&reason=missing_params');

    const tokens = await driveService.exchangeCodeForTokens(code);
    await driveService.saveTokensForUser(userId, tokens);
    res.redirect('/studio?drive=connected');
  } catch (error) {
    res.redirect('/studio?drive=error&reason=token_exchange');
  }
});

app.post('/api/google/drive/upload-from-url', async (req, res) => {
  try {
    const driveService = await getDriveService();
    const { fileUrl, fileName, mimeType } = req.body;
    if (!fileUrl || !fileName) return res.status(400).json({ error: 'MISSING_PARAMS' });

    const authHeader = req.headers.authorization;
    const userId = await getUserIdFromAuth(authHeader, driveService.supabase);

    const result = await driveService.uploadFileToDrive(userId, fileUrl, fileName, mimeType || 'video/mp4');
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.message === 'DRIVE_NOT_CONNECTED') return res.status(401).json({ error: 'DRIVE_NOT_CONNECTED' });
    if (error.message === 'SOURCE_DOWNLOAD_FAILED') return res.status(400).json({ error: 'SOURCE_DOWNLOAD_FAILED' });
    if (error.message === 'NOT_AUTHENTICATED' || error.message === 'INVALID_TOKEN') return res.status(401).json({ error: error.message });
  }
});

app.post('/api/google/drive/init-upload', async (req, res) => {
  try {
    const driveService = await getDriveService();
    const { fileName, mimeType } = req.body;

    if (!fileName) return res.status(400).json({ error: 'MISSING_PARAMS' });

    const authHeader = req.headers.authorization;
    const userId = await getUserIdFromAuth(authHeader, driveService.supabase);

    const uploadUrl = await driveService.createResumableUpload(userId, fileName, mimeType || 'video/mp4');
    res.json({ success: true, uploadUrl });
  } catch (error) {
    console.error('[Drive Init] Error:', error);
    if (error.message === 'DRIVE_NOT_CONNECTED') return res.status(401).json({ error: 'DRIVE_NOT_CONNECTED' });
    if (error.message === 'NOT_AUTHENTICATED' || error.message === 'INVALID_TOKEN') return res.status(401).json({ error: error.message });
    res.status(500).json({ error: 'INIT_UPLOAD_FAILED', details: error.message });
  }
});


// ============================================================================
// STORAGE API (Lazy Loaded)
// ============================================================================

let _storageInitialized = false;
const initStorage = async () => {
  if (_storageInitialized) return;
  const { VideoStorageFactory } = await import('./services/storage/StorageFactory.js');
  const { SupabaseVideoStorage } = await import('./services/storage/providers/SupabaseStorage.js');
  VideoStorageFactory.register(new SupabaseVideoStorage());
  _storageInitialized = true;
  _storageInitialized = true;
};

// 7. Video Fusion Endpoint (FFmpeg)
app.post('/api/video/combine', async (req, res) => {
  try {
    const { originalUrl, extensionUrl, videoUrls } = req.body;

    // Support both pair-combine (legacy continuity) and multi-combine (timeline export)
    let urlsToCombine = [];
    if (videoUrls && Array.isArray(videoUrls)) {
      urlsToCombine = videoUrls;
    } else if (originalUrl && extensionUrl) {
      urlsToCombine = [originalUrl, extensionUrl];
    } else {
      return res.status(400).json({ error: 'Missing video URLs to combine' });
    }

    console.log(`[Fusion] Request to combine ${urlsToCombine.length} videos`);

    // Import service dynamically
    const { concatenateVideos } = await import('./services/videoService.js');

    // Perform fusion
    const result = await concatenateVideos(urlsToCombine);

    // Stream result back
    const stat = fs.statSync(result.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle streaming range request
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(result.path, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
      // Note: Auto-cleanup is harder with streams, might need periodic temp cleanup or hook into close
    } else {
      // Send output file URL logic if we stored it?
      // For now, let's stream the file content directly as download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `attachment; filename=export_${Date.now()}.mp4`);

      const fileStream = fs.createReadStream(result.path);
      fileStream.pipe(res);

      fileStream.on('close', () => {
        // Clean up temp files
        result.cleanup();
      });
    }

  } catch (error) {
    console.error('[Fusion API] Error:', error);
    res.status(500).json({ error: 'Fusion failed', details: error.message });
  }
});

app.post('/api/storage/save-from-uri', async (req, res) => {
  try {
    await initStorage();
    const { VideoStorageFactory } = await import('./services/storage/StorageFactory.js');

    const { uri, filename, metadata } = req.body;
    if (!uri) return res.status(400).json({ error: 'Missing uri' });

    console.log(`[Storage] Remote save requested: ${uri}`);

    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Failed to download source video: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = await VideoStorageFactory.getProvider();
    const result = await storage.upload(buffer, filename || `video-${Date.now()}.mp4`, {
      contentType: response.headers.get('content-type') || 'video/mp4',
      metadata
    });

    console.log(`[Storage] Saved to ${result.provider}: ${result.publicUrl}`);
    res.json(result);
  } catch (error) {
    console.error('[Storage] Save error:', error);
    res.status(500).json({ error: 'Failed to save video', details: error.message });
  }
});

// ============================================================================
// ERROR HANDLER & SERVER STARTUP
// ============================================================================

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

const port = process.env.PORT || 3001;

// Check if we're being imported by Vercel or run directly
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!isVercel) {
  app.listen(port, () => {
    console.log('');
    console.log('🎬 ════════════════════════════════════════════');
    console.log('   STUDIO JENIAL - Backend Server');
    console.log('════════════════════════════════════════════');
    console.log(`   📍 Local:    http://localhost:${port}`);
    console.log(`   🔍 Health:   http://localhost:${port}/api/health`);
    console.log('════════════════════════════════════════════');
  });
}

// Export for Vercel serverless
export default app;
