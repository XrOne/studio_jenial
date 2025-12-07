console.log('Server starting...');
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as driveService from './services/googleDriveService.js';

// Load env files (optional - only for local dev convenience)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();

// Allow large payloads for base64 images/videos
app.use(bodyParser.json({ limit: '100mb' }));
app.use(cors());

// Veo API Configuration
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Security: Allowed URL patterns for proxy
const ALLOWED_PROXY_PATTERNS = [
  /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[^/]+:download\?alt=media$/
];

// Security: Block private/local IPs
const isPrivateIP = (hostname) => {
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i
  ];
  return privatePatterns.some(pattern => pattern.test(hostname));
};

/**
 * Dual Mode API Key Management
 *
 * Priority 1: Server-managed key from GEMINI_API_KEY env var
 * Priority 2: User-provided key via 'x-api-key' header (BYOK mode)
 * 
 * In production with env key set, users don't need to provide a key.
 * In BYOK mode (beta), each user must provide their own key.
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

const getClient = (req) => {
  const apiKey = getApiKey(req);
  return new GoogleGenAI({ apiKey });
};

// Error handler middleware with proper error mapping
const handleError = (res, error) => {
  // Don't log API keys - only log error code/message
  const errorCode = error.code || 'UNKNOWN_ERROR';
  const statusCode = error.statusCode || 500;

  // Map specific error types for frontend
  if (errorCode === 'API_KEY_MISSING') {
    return res.status(401).json({ error: 'API_KEY_MISSING' });
  }

  if (errorCode === 'API_KEY_INVALID' || (statusCode === 401 && !error.code)) {
    return res.status(401).json({ error: 'API_KEY_INVALID' });
  }

  if (statusCode === 400) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      details: error.message || 'Invalid request'
    });
  }

  // For all other errors
  console.error('API Error:', errorCode);
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'INTERNAL_ERROR' : error.message,
    code: errorCode
  });
};

// --- Endpoints ---

// Configuration endpoint for frontend to check mode
app.get('/api/config', (req, res) => {
  const hasServerKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 20);
  res.json({
    hasServerKey,
    requiresUserKey: !hasServerKey
  });
});

app.get('/', (req, res) => {
  const hasServerKey = !!process.env.GEMINI_API_KEY;
  res.json({
    name: '🎬 Studio Jenial API',
    mode: hasServerKey ? 'Server-Managed' : 'BYOK (Bring Your Own Key)',
    status: 'running',
    message: hasServerKey
      ? 'Server API key configured'
      : 'Each user must provide their own Gemini API key'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hasServerKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: 'ok',
    mode: hasServerKey ? 'server-managed' : 'BYOK',
    requiresUserKey: !hasServerKey,
    message: hasServerKey
      ? 'Server API key configured'
      : 'Users must provide their own Gemini API key in the x-api-key header'
  });
});

// 1. General Content Generation (Text, Images, etc.)
app.post('/api/generate-content', async (req, res) => {
  try {
    const ai = getClient(req);
    const { model, contents, config } = req.body;

    const response = await ai.models.generateContent({
      model,
      contents,
      config
    });
    res.json(response);
  } catch (error) {
    handleError(res, error);
  }
});

// 2. Video Generation (Veo) - Start generation using predictLongRunning
// Uses instances format required by Veo 3.1 models
// Spec endpoint: POST /api/video/generate -> { operationName }
app.post('/api/video/generate', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { model, prompt, parameters } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[Veo] Starting video generation with model: ${model}`);

    // Build request body - MUST use instances format for predictLongRunning
    const requestBody = {
      instances: [{ prompt: prompt.trim() }]
    };

    // Add parameters if provided
    if (parameters && Object.keys(parameters).length > 0) {
      requestBody.parameters = parameters;
    }

    console.log('[Veo] Request body:', JSON.stringify(requestBody, null, 2));

    const endpoint = `${VEO_API_BASE}/models/${model}:predictLongRunning`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      console.error('[Veo] API Error:', errorMessage);
      return res.status(response.status).json({
        error: `Veo API Error: ${errorMessage}`,
        code: errorData.error?.code || 'VEO_ERROR'
      });
    }

    const data = await response.json();

    if (!data.name) {
      return res.status(500).json({ error: 'No operation name returned from Veo API' });
    }

    console.log('[Veo] Operation started:', data.name);

    res.json({ operationName: data.name });
  } catch (error) {
    console.error('[Veo] Start error:', error);
    handleError(res, error);
  }
});

// 3. Poll Video Operation Status
// Spec endpoint: GET /api/video/status?name=... -> { done, videoUri? }
app.get('/api/video/status', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    // Support both 'name' (spec) and 'operationName' (legacy) query params
    const operationName = req.query.name || req.query.operationName;

    if (!operationName) {
      return res.status(400).json({ error: 'name query parameter is required' });
    }

    console.log('[Veo] Polling operation:', operationName);

    const pollUrl = `${VEO_API_BASE}/${operationName}`;

    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      return res.status(response.status).json({
        error: `Veo Poll Error: ${errorMessage}`,
        code: errorData.error?.code || 'VEO_POLL_ERROR'
      });
    }

    const data = await response.json();

    // Check for operation error
    if (data.error) {
      return res.status(500).json({
        done: true,
        error: data.error.message || 'Operation failed',
        code: data.error.code || 'VEO_OPERATION_ERROR'
      });
    }

    // Check if done
    if (!data.done) {
      return res.json({ done: false });
    }

    // Extract video URI from response
    const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    if (!videoUri) {
      console.error('[Veo] No video URI in response:', JSON.stringify(data, null, 2));
      return res.status(500).json({
        done: true,
        error: 'No video URI in completed operation response'
      });
    }

    console.log('[Veo] Video ready:', videoUri);

    res.json({
      done: true,
      videoUri
    });
  } catch (error) {
    console.error('[Veo] Poll error:', error);
    handleError(res, error);
  }
});

// 4. Proxy Video Download (SECURED)
// Only allows downloads from generativelanguage.googleapis.com/v1beta/files/*
app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUri = req.query.uri;
    const apiKey = getApiKey(req);

    if (!videoUri) {
      return res.status(400).json({ error: 'Missing video URI' });
    }

    // Security: Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(videoUri);
    } catch {
      return res.status(400).json({ error: 'Invalid URI format' });
    }

    // Security: Block private IPs
    if (isPrivateIP(parsedUrl.hostname)) {
      console.warn('[Veo] Blocked proxy attempt to private IP:', parsedUrl.hostname);
      return res.status(403).json({ error: 'Proxy to private/local addresses is not allowed' });
    }

    // Security: Only allow specific Google API patterns
    const isAllowed = ALLOWED_PROXY_PATTERNS.some(pattern => pattern.test(videoUri));
    if (!isAllowed) {
      // Also allow the generic files download pattern
      const genericPattern = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\//;
      if (!genericPattern.test(videoUri)) {
        console.warn('[Veo] Blocked proxy to unauthorized URL:', videoUri);
        return res.status(403).json({
          error: 'Only Google generativelanguage API file downloads are allowed'
        });
      }
    }

    console.log('[Veo] Proxying video download...');

    // Use x-goog-api-key header instead of query param
    const response = await fetch(videoUri, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentType) res.setHeader('Content-Type', contentType);

    // Stream the response
    const { pipeline } = await import('stream/promises');
    await pipeline(response.body, res);

  } catch (error) {
    console.error('[Veo] Proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy video' });
    }
  }
});

// Legacy endpoint - redirect to new API
app.post('/api/generate-videos', async (req, res) => {
  console.log('[Veo] Legacy /api/generate-videos called - redirecting to new API');
  // For backwards compatibility, try to use the new flow
  try {
    const apiKey = getApiKey(req);
    const { model, prompt, config } = req.body;

    // Start generation
    const startBody = {
      instances: [{ prompt: prompt || '' }]
    };

    if (config) {
      const params = {};
      if (config.aspectRatio) params.aspectRatio = config.aspectRatio;
      if (config.resolution) params.resolution = config.resolution;
      if (Object.keys(params).length > 0) {
        startBody.parameters = params;
      }
    }

    const endpoint = `${VEO_API_BASE}/models/${model}:predictLongRunning`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(startBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || response.statusText);
    }

    const data = await response.json();
    console.log('[Veo] Legacy - Operation started:', data.name);

    // Return operation name for polling
    res.json({
      operationName: data.name,
      message: 'Use /api/veo/status?operationName=... to poll for results'
    });
  } catch (error) {
    console.error('[Veo] Legacy endpoint error:', error);
    handleError(res, error);
  }
});

// Legacy poll endpoint
app.post('/api/get-video-operation', async (req, res) => {
  console.log('[Veo] Legacy /api/get-video-operation called');
  try {
    const apiKey = getApiKey(req);
    const { operationName } = req.body;

    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }

    const pollUrl = `${VEO_API_BASE}/${operationName}`;
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || response.statusText);
    }

    const data = await response.json();

    if (data.error) {
      return res.json({ done: true, error: data.error.message });
    }

    if (!data.done) {
      return res.json({ done: false, name: operationName });
    }

    const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    res.json({
      done: true,
      name: operationName,
      videoUri,
      response: data.response
    });
  } catch (error) {
    console.error('[Veo] Legacy poll error:', error);
    handleError(res, error);
  }
});

// ==========================================
// GOOGLE DRIVE INTEGRATION
// ==========================================
// Allows users to save generated videos/images to their own Google Drive
// No files are stored persistently on our servers

// Check if Drive integration is enabled
app.get('/api/google/drive/enabled', (req, res) => {
  res.json({
    enabled: driveService.isDriveConfigured()
  });
});

// Get Drive connection status for current user
app.get('/api/google/drive/status', async (req, res) => {
  try {
    // Get user ID from Supabase auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ connected: false, reason: 'NOT_AUTHENTICATED' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.json({ connected: false, reason: 'INVALID_TOKEN' });
    }

    const connected = await driveService.isDriveConnected(user.id);
    res.json({ connected });
  } catch (error) {
    console.error('Drive status error:', error.message);
    res.json({ connected: false, reason: 'ERROR' });
  }
});

// Start OAuth flow - redirects user to Google
app.get('/api/google/drive/auth', async (req, res) => {
  try {
    if (!driveService.isDriveConfigured()) {
      return res.status(503).json({ error: 'DRIVE_NOT_CONFIGURED' });
    }

    // Get user ID from query or session
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'USER_ID_REQUIRED' });
    }

    const authUrl = driveService.getAuthUrl(userId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Drive auth error:', error.message);
    res.status(500).json({ error: 'AUTH_FAILED' });
  }
});

// OAuth callback from Google
app.get('/api/google/drive/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.redirect('/studio?drive=error&reason=missing_params');
    }

    // Exchange code for tokens
    const tokens = await driveService.exchangeCodeForTokens(code);

    // Save tokens for user
    await driveService.saveTokensForUser(userId, tokens);

    // Redirect back to studio with success
    res.redirect('/studio?drive=connected');
  } catch (error) {
    console.error('Drive callback error:', error.message);
    res.redirect('/studio?drive=error&reason=token_exchange');
  }
});

// Upload file from URL to user's Drive
app.post('/api/google/drive/upload-from-url', async (req, res) => {
  try {
    const { fileUrl, fileName, mimeType } = req.body;

    if (!fileUrl || !fileName) {
      return res.status(400).json({ error: 'MISSING_PARAMS', details: 'fileUrl and fileName required' });
    }

    // Get user from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    // Upload to Drive
    const result = await driveService.uploadFileToDrive(
      user.id,
      fileUrl,
      fileName,
      mimeType || 'video/mp4'
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Drive upload error:', error.message);

    if (error.message === 'DRIVE_NOT_CONNECTED') {
      return res.status(401).json({ error: 'DRIVE_NOT_CONNECTED' });
    }
    if (error.message === 'SOURCE_DOWNLOAD_FAILED') {
      return res.status(400).json({ error: 'SOURCE_DOWNLOAD_FAILED' });
    }

    res.status(500).json({ error: 'UPLOAD_FAILED', details: error.message });
  }
});
const port = process.env.PORT || 3001;

// Check if we're being imported by Vercel or run directly
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Force local startup - always start unless explicitly on Vercel
if (!isVercel) {
  const server = app.listen(port, () => {
    console.log('');
    console.log('🎬 ════════════════════════════════════════════');
    console.log('   STUDIO JENIAL - Backend Server');
    console.log('════════════════════════════════════════════');
    console.log('');
    console.log(`   📍 Local:    http://localhost:${port}`);
    console.log(`   🔍 Health:   http://localhost:${port}/api/health`);
    console.log('');
    console.log('   🔑 Mode: BYOK (Bring Your Own Key)');
    console.log('   → Each user provides their own Gemini API key');
    console.log('');
    console.log('   ✅ Supabase: Configured');
    console.log(`   📦 Buckets: videos, images, thumbnails`);
    console.log('');
    console.log('════════════════════════════════════════════');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');
  });

  // Keep process alive
  server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });
}

// Export for Vercel serverless
export default app;

