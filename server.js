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

// 2. Video Generation (Veo)
app.post('/api/generate-videos', async (req, res) => {
  try {
    const ai = getClient(req);
    const payload = req.body;
    
    console.log(`[Veo] Starting video generation with model: ${payload.model}`);
    const operation = await ai.models.generateVideos(payload);
    console.log(`[Veo] Operation started: ${operation.name}`);
    
    res.json(operation);
  } catch (error) {
    handleError(res, error);
  }
});

// 3. Poll Video Operation Status
app.post('/api/get-video-operation', async (req, res) => {
  try {
    const ai = getClient(req);
    const { operationName } = req.body;
    
    const operation = await ai.operations.getVideosOperation({
      operation: { name: operationName }
    });
    
    if (operation.done) {
      console.log(`[Veo] Operation completed: ${operationName}`);
    }
    
    res.json(operation);
  } catch (error) {
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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('Proxy Video Error:', error);
    res.status(500).json({ error: 'Error fetching video: ' + error.message });
  }
});

// --- Start Server ---
// Always start when this file is executed directly
const port = process.env.PORT || 3001;

// Check if we're being imported by Vercel or run directly
// On Vercel, the app is imported, not run directly
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!isVercel) {
  app.listen(port, () => {
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
    console.log('════════════════════════════════════════════');
    console.log('');
  });
}

// Export for Vercel serverless
export default app;
