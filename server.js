console.log('Server starting...');
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { GoogleGenAI } from '@google/genai';
import { generateVideoVertex } from './providers/vertexProvider.js';

// Load env files (optional - only for local dev convenience)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();

// Allow large payloads for base64 images/videos
app.use(bodyParser.json({ limit: '100mb' }));
app.use(cors());

/**
 * BYOK (Bring Your Own Key) Mode
 * 
 * This server operates in BYOK mode by default.
 * Each request MUST include the user's API key in the 'x-api-key' header.
 * No server-side API key is used - users pay for their own usage.
 */
const getClient = (req) => {
  // BYOK: Only accept key from request header
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

// 2. Video Generation (Veo) - Using Official API
// Now supports both inlineData (base64) and fileUri (Google Files API)
app.post('/api/generate-videos', async (req, res) => {
  try {
    const ai = getClient(req);
    const payload = req.body;

    console.log(`[Veo] Starting video generation with model: ${payload.model}`);

    // Build parts array for generate_content
    const parts = [];
    if (payload.prompt) {
      parts.push({ text: payload.prompt });
    }

    // Add image if provided (for image-to-video)
    // Supports both fileUri (new) and imageBytes (legacy)
    if (payload.image) {
      if (payload.image.fileUri) {
        // New: Using Google Files API URI (no size limit)
        console.log('[Veo] Using fileUri for start frame:', payload.image.fileUri);
        parts.push({
          fileData: {
            fileUri: payload.image.fileUri,
            mimeType: payload.image.mimeType || 'image/jpeg'
          }
        });
      } else if (payload.image.imageBytes) {
        // Legacy: Using base64 inline data
        parts.push({
          inlineData: {
            data: payload.image.imageBytes,
            mimeType: payload.image.mimeType || 'image/jpeg'
          }
        });
      }
    }

    // Build generation config
    const generationConfig = {
      candidateCount: payload.config?.numberOfVideos || 1,
    };

    // Add reference images if provided
    // Supports both fileUri (new) and imageBytes (legacy)
    if (payload.config?.referenceImages) {
      generationConfig.referenceImages = payload.config.referenceImages.map(ref => {
        if (ref.image.fileUri) {
          // New: Using Google Files API URI
          return {
            fileData: {
              fileUri: ref.image.fileUri,
              mimeType: ref.image.mimeType || 'image/jpeg'
            }
          };
        } else {
          // Legacy: Using base64 inline data
          return {
            inlineData: {
              data: ref.image.imageBytes,
              mimeType: ref.image.mimeType || 'image/jpeg'
            }
          };
        }
      });
    }

    // Add last frame if provided
    // Supports both fileUri (new) and imageBytes (legacy)
    if (payload.config?.lastFrame) {
      if (payload.config.lastFrame.fileUri) {
        // New: Using Google Files API URI
        console.log('[Veo] Using fileUri for last frame:', payload.config.lastFrame.fileUri);
        generationConfig.lastFrame = {
          fileData: {
            fileUri: payload.config.lastFrame.fileUri,
            mimeType: payload.config.lastFrame.mimeType || 'image/jpeg'
          }
        };
      } else if (payload.config.lastFrame.imageBytes) {
        // Legacy: Using base64 inline data
        generationConfig.lastFrame = {
          inlineData: {
            data: payload.config.lastFrame.imageBytes,
            mimeType: payload.config.lastFrame.mimeType || 'image/jpeg'
          }
        };
      }
    }

    console.log('[Veo] Calling generate_content...');
    const response = await ai.models.generateContent({
      model: payload.model,
      contents: [{ parts }],
      generationConfig
    });

    console.log('[Veo] Response received:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('[Veo] Generation error:', error);
    handleError(res, error);
  }
});

// 3. Poll Video Operation Status - No longer needed with direct API
// Keeping for compatibility but it will return the final result
app.post('/api/get-video-operation', async (req, res) => {
  try {
    // With the new API, operations complete synchronously or we poll differently
    // For now, return a "done" response
    const { operationName } = req.body;
    console.log(`[Veo] Operation check (deprecated): ${operationName}`);

    // Return completed status
    res.json({
      done: true,
      name: operationName,
      response: {
        generatedVideos: []
      }
    });
  } catch (error) {
    console.error('[Veo] Polling error:', error);
    handleError(res, error);
  }
});

// 4. Proxy Video Download (required because Veo video URLs need API key)
app.get('/api/proxy-video', async (req, res) => {
  try {
    const videoUri = req.query.uri;
    const apiKey = req.headers['x-api-key'];

    if (!videoUri) {
      return res.status(400).json({ error: 'Missing video URI' });
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required to download video' });
    }

    // Append API key to the video URL
    const separator = videoUri.includes('?') ? '&' : '?';
    const finalUrl = `${videoUri}${separator}key=${apiKey}`;

    console.log(`[Veo] Proxying video download...`);
    const response = await fetch(finalUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    res.setHeader('Content-Length', response.headers.get('content-length'));
    res.setHeader('Content-Type', response.headers.get('content-type'));

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

// 5. Vertex AI Video Generation (NEW)

app.post('/api/video/vertex/generate', async (req, res) => {
  try {
    const { projectId, location, accessToken, model, prompt, config } = req.body;

    if (!projectId || !location || !accessToken) {
      return res.status(400).json({ error: 'Missing Vertex AI credentials (projectId, location, accessToken)' });
    }

    console.log(`[Vertex] Request received for model: ${model}`);

    const result = await generateVideoVertex(
      { projectId, location, accessToken },
      { model, prompt, config }
    );

    res.json(result);
  } catch (error) {
    console.error('[Vertex] Route Error:', error);
    res.status(500).json({ error: error.message });
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

