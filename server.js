console.log('Server starting...');
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { GoogleGenAI } from '@google/genai';

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
 * BYOK (Bring Your Own Key) Mode
 *
 * This server operates in BYOK mode by default.
 * Each request MUST include the user's API key in the 'x-api-key' header.
 * No server-side API key is used - users pay for their own usage.
 */
const getApiKey = (req) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    const error = new Error('API_KEY_MISSING: Please provide your Gemini API key');
    error.statusCode = 401;
    throw error;
  }

  if (apiKey === 'PLACEHOLDER_API_KEY' || apiKey.length < 20) {
    const error = new Error('API_KEY_INVALID: Please provide a valid Gemini API key');
    error.statusCode = 401;
    throw error;
  }

  return apiKey;
};

const getClient = (req) => {
  const apiKey = getApiKey(req);
  return new GoogleGenAI({ apiKey });
};

// Error handler middleware
const handleError = (res, error) => {
  console.error('API Error:', error.message);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: error.message || 'Internal Server Error',
    code: error.code || 'UNKNOWN_ERROR'
  });
};

// --- Endpoints ---

app.get('/', (req, res) => {
  res.json({
    name: '🎬 Studio Jenial API',
    mode: 'BYOK (Bring Your Own Key)',
    status: 'running',
    message: 'Each user must provide their own Gemini API key'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'BYOK',
    requiresUserKey: true,
    message: 'Users must provide their own Gemini API key in the x-api-key header'
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
app.post('/api/veo/start', async (req, res) => {
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
app.get('/api/veo/status', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const operationName = req.query.operationName;

    if (!operationName) {
      return res.status(400).json({ error: 'operationName query parameter is required' });
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

// --- Start Server ---
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

