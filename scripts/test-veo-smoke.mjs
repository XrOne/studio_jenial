#!/usr/bin/env node
/**
 * Veo Smoke Test Script
 *
 * Tests the Veo video generation flow with BYOK (Bring Your Own Key)
 * Uses predictLongRunning API with instances format
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/test-veo-smoke.mjs
 *
 * Or set the key in environment first:
 *   export GEMINI_API_KEY=your_key
 *   node scripts/test-veo-smoke.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VEO_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'veo-3.1-fast-generate-preview';
const TEST_PROMPT = 'A gentle ocean wave rolling onto a sandy beach at sunset, cinematic lighting';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 10 * 60 * 1000; // 10 minutes
const MIN_VIDEO_SIZE = 1024 * 1024; // 1MB

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`),
};

// Get API key from environment (NEVER hardcode!)
const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    log.error('GEMINI_API_KEY environment variable is not set');
    log.info('Usage: GEMINI_API_KEY=your_key node scripts/test-veo-smoke.mjs');
    process.exit(1);
  }
  if (!key.startsWith('AIza')) {
    log.error('Invalid API key format (should start with AIza...)');
    process.exit(1);
  }
  return key;
};

// Start video generation
async function startGeneration(apiKey) {
  log.step('Starting video generation...');
  log.info(`Model: ${MODEL}`);
  log.info(`Prompt: "${TEST_PROMPT}"`);

  const endpoint = `${VEO_API_BASE}/models/${MODEL}:predictLongRunning`;

  // MUST use instances format
  const requestBody = {
    instances: [{ prompt: TEST_PROMPT }]
  };

  log.info('Request body: { instances: [{ prompt: "..." }] }');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey // Header auth, not query param
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (!data.name) {
    throw new Error('No operation name in response');
  }

  log.success(`Operation started: ${data.name}`);
  return data.name;
}

// Poll operation status
async function pollOperation(apiKey, operationName) {
  log.step('Polling operation status...');

  const pollUrl = `${VEO_API_BASE}/${operationName}`;
  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    pollCount++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey // Header auth
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Poll Error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Operation failed: ${data.error.message}`);
    }

    if (data.done) {
      log.success(`Operation completed after ${elapsed}s (${pollCount} polls)`);

      // Extract video URI
      const videoUri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

      if (!videoUri) {
        console.error('Full response:', JSON.stringify(data, null, 2));
        throw new Error('No video URI in completed operation');
      }

      log.success(`Video URI: ${videoUri}`);
      return videoUri;
    }

    log.info(`Still processing... (${elapsed}s elapsed, poll #${pollCount})`);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout: Operation did not complete within ${MAX_POLL_TIME_MS / 1000}s`);
}

// Download video
async function downloadVideo(apiKey, videoUri, outputPath) {
  log.step('Downloading video...');

  const response = await fetch(videoUri, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey // Header auth for download too
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  log.info(`Content-Length: ${contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown'}`);

  const buffer = Buffer.from(await response.arrayBuffer());

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  log.success(`Video saved to: ${outputPath}`);

  return buffer.length;
}

// Verify video
function verifyVideo(outputPath, fileSize) {
  log.step('Verifying video...');

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Output file not found: ${outputPath}`);
  }

  const stats = fs.statSync(outputPath);
  log.info(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  if (stats.size < MIN_VIDEO_SIZE) {
    throw new Error(`Video too small (${stats.size} bytes). Expected at least ${MIN_VIDEO_SIZE} bytes (1MB)`);
  }

  // Check magic bytes for MP4
  const buffer = fs.readFileSync(outputPath);
  const magic = buffer.slice(4, 8).toString('ascii');

  if (magic !== 'ftyp') {
    log.warn(`File may not be a valid MP4 (magic bytes: ${magic})`);
  } else {
    log.success('Valid MP4 file detected');
  }

  log.success(`Video verified: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

// Main test flow
async function runSmokeTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  VEO VIDEO GENERATION SMOKE TEST');
  console.log('  BYOK Mode - Using predictLongRunning API');
  console.log('='.repeat(60) + '\n');

  const apiKey = getApiKey();
  log.success('API key loaded from environment (key not logged)');

  const outputPath = path.join(__dirname, '..', 'tmp', 'veo_smoke.mp4');

  try {
    // Step 1: Start generation
    const operationName = await startGeneration(apiKey);

    // Step 2: Poll until complete
    const videoUri = await pollOperation(apiKey, operationName);

    // Step 3: Download video
    const fileSize = await downloadVideo(apiKey, videoUri, outputPath);

    // Step 4: Verify video
    verifyVideo(outputPath, fileSize);

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.green}  SMOKE TEST PASSED${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`\n  Video saved to: ${outputPath}`);
    console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\n`);

    process.exit(0);

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.red}  SMOKE TEST FAILED${colors.reset}`);
    console.log('='.repeat(60));
    log.error(error.message);
    console.log('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
runSmokeTest();
