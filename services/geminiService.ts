import {
  ChatMessage,
  ComplianceResult,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  PromptSequence,
  PromptSequenceStatus,
  RegeneratePromptParams,
  ReviseFollowingPromptsParams,
  Storyboard,
  VeoModel,
  VideoFile,
} from '../types';
import {
  isSupabaseConfigured,
  // uploadVideoToSupabase, // Removed in favor of VideoStorageProvider
  uploadImageToSupabase
} from './supabaseClient';
import { VideoStorageFactory } from './VideoStorageProvider';
import { SupabaseVideoStorage } from './storage/SupabaseVideoStorage';

// Initialize Storage Providers
// Verify we are not re-registering on hot reloads if possible, or Factory handles overwrites
VideoStorageFactory.register(new SupabaseVideoStorage());

// ===========================================
// IMAGE COMPRESSION (to reduce payload size for Vercel 4.5MB limit)
// ===========================================

/**
 * Compress a base64-encoded image to reduce payload size.
 * Resizes to max dimension and compresses to JPEG.
 */
const compressImageBase64 = (base64: string, maxDimension: number = 1024, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with compression
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const compressedBase64 = dataUrl.split(',')[1];
        resolve(compressedBase64);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
};

// ===========================================
// Reference: https://ai.google.dev/gemini-api/docs/models

const MODELS = {
  // Gemini 3 Pro - Latest reasoning model
  PRO: 'gemini-3-pro-preview',

  // Gemini 2.5 Flash - Fast and efficient
  FLASH: 'gemini-2.5-flash',

  // Gemini 3 Pro Image (Nano Banana Pro) - High-fidelity image generation
  IMAGE_PRO: 'gemini-3-pro-image-preview',

  // Gemini 2.5 Flash Image (Nano Banana) - Fast image generation/editing
  IMAGE_FLASH: 'gemini-2.5-flash-image',

  // TTS Preview
  TTS: 'gemini-2.5-flash-preview-tts',
};

// ===========================================
// API KEY MANAGEMENT (Dual Mode: Server-Managed + BYOK)
// ===========================================

// Cached config to avoid repeated /api/config calls
let cachedConfig: { hasServerKey: boolean; requiresUserKey: boolean } | null = null;

/**
 * Fetch server configuration to determine API key mode
 * - hasServerKey: true if server has GEMINI_API_KEY env configured
 * - requiresUserKey: true if user must provide their own key (BYOK mode)
 */
export const fetchGeminiConfig = async (): Promise<{ hasServerKey: boolean; requiresUserKey: boolean }> => {
  if (cachedConfig) return cachedConfig;

  try {
    const res = await fetch('/api/config');
    if (!res.ok) {
      // Fallback to BYOK mode if config endpoint fails
      cachedConfig = { hasServerKey: false, requiresUserKey: true };
      return cachedConfig;
    }
    cachedConfig = await res.json();
    return cachedConfig;
  } catch {
    // Network error - fallback to BYOK mode
    cachedConfig = { hasServerKey: false, requiresUserKey: true };
    return cachedConfig;
  }
};

/**
 * Reset cached config (useful for testing or after configuration changes)
 */
export const resetConfigCache = () => {
  cachedConfig = null;
};

/**
 * Get API key from localStorage (BYOK mode)
 * Returns null if not set or invalid
 */
export const getLocalApiKey = (): string | null => {
  if (typeof window === 'undefined') return null;
  const key = window.localStorage.getItem('gemini_api_key');
  return key && key.trim().length >= 20 ? key.trim() : null;
};

/**
 * Save API key to localStorage (BYOK mode)
 */
export const setLocalApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('gemini_api_key', key.trim());
};

/**
 * Remove API key from localStorage
 */
export const clearLocalApiKey = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('gemini_api_key');
};

// Legacy exports for backward compatibility
export const getApiKey = (): string => {
  return getLocalApiKey() || '';
};

export const hasCustomApiKey = (): boolean => {
  const key = getLocalApiKey();
  return !!(key && key.startsWith('AIza'));
};

// ===========================================
// API CALL HELPERS
// ===========================================

const API_BASE = '/api';
const GOOGLE_FILES_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

/**
 * Custom error type for API calls
 */
export interface ApiError {
  status: number;
  error: string;
  data?: any;
}

/**
 * Call backend endpoint with proper API key handling
 * - If server has key configured, no header needed
 * - If BYOK mode, adds x-api-key header from localStorage
 */
export const callVeoBackend = async (path: string, body: any): Promise<any> => {
  const config = await fetchGeminiConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Only add user key header if server doesn't have a key configured
  if (!config.hasServerKey) {
    const key = getLocalApiKey();
    if (key) {
      headers['x-api-key'] = key;
    }
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const apiError: ApiError = {
      status: res.status,
      error: data.error || 'UNKNOWN_ERROR',
      data
    };
    throw apiError;
  }

  return data;
};

// Legacy apiCall function for backward compatibility
const apiCall = async (endpoint: string, body: any) => {
  const config = await fetchGeminiConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!config.hasServerKey) {
    const apiKey = getLocalApiKey();
    if (!apiKey) {
      throw new Error('API_KEY_MISSING: Please enter your Gemini API key first');
    }
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));

    // Log structured error for debugging
    console.error('[ContextAPI] Error from backend', {
      status: res.status,
      code: err.code,
      message: err.message,
      error: err.error
    });

    // Use user-friendly message if available, otherwise fallback
    const userMessage = err.message || err.error || `API Request Failed: ${res.status}`;
    const error = new Error(userMessage) as any;
    error.code = err.code || 'UNKNOWN_ERROR';
    error.status = res.status;
    throw error;
  }
  return res.json();
};

// Helper to extract text from various response formats
const extractText = (response: any): string => {
  if (typeof response === 'string') return response;
  if (response.text) return response.text;
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    return response.candidates[0].content.parts[0].text;
  }
  return '';
};

// ===========================================
// GOOGLE FILES API - Upload large files directly to Google
// Bypasses Vercel 4.5MB limit - supports up to 2GB per file
// ===========================================

interface GoogleFileUploadResult {
  fileUri: string;
  mimeType: string;
  displayName: string;
}

/**
 * Upload a file to Google Files API via backend proxy
 * SECURITY: API key is handled server-side, never sent from browser
 * @param file - File or Blob to upload
 * @param displayName - Optional display name for the file
 * @returns fileUri that can be used with Gemini/Veo APIs
 */
export const uploadToGoogleFiles = async (
  file: File | Blob,
  displayName?: string
): Promise<GoogleFileUploadResult> => {
  const mimeType = file instanceof File ? file.type : 'application/octet-stream';
  const fileName = displayName || (file instanceof File ? file.name : `upload-${Date.now()}`);
  const numBytes = file.size;

  console.log(`[GoogleFiles] Starting upload: ${fileName} (${(numBytes / 1024 / 1024).toFixed(2)} MB)`);

  // Step 1: Get pre-signed upload URL from our backend (API key handled server-side)
  const config = await fetchGeminiConfig();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Only add user key header if server doesn't have a key configured (BYOK mode)
  if (!config.hasServerKey) {
    const key = getLocalApiKey();
    if (!key) {
      throw new Error('API_KEY_MISSING: Please enter your Gemini API key first');
    }
    headers['x-api-key'] = key;
  }

  const initResponse = await fetch('/api/files/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      displayName: fileName,
      mimeType,
      fileSize: numBytes,
    }),
  });

  if (!initResponse.ok) {
    const errorData = await initResponse.json().catch(() => ({}));
    throw new Error(`Failed to initialize upload: ${initResponse.status} - ${errorData.error || 'Unknown error'}`);
  }

  const { uploadUrl } = await initResponse.json();
  if (!uploadUrl) {
    throw new Error('No upload URL received from backend');
  }

  console.log('[GoogleFiles] Upload URL received (via backend), uploading file...');

  // Step 2: Upload file directly to Google using pre-signed URL (no API key needed)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': numBytes.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${uploadResponse.status} - ${errorText}`);
  }

  const result = await uploadResponse.json();

  if (!result.file || !result.file.uri) {
    throw new Error('No file URI in upload response');
  }

  console.log(`[GoogleFiles] Upload complete: ${result.file.uri}`);

  return {
    fileUri: result.file.uri,
    mimeType: mimeType,
    displayName: fileName,
  };
};

/**
 * Convert an ImageFile (with base64) to a Google Files URI
 * Use this for large images that would exceed Vercel's limit
 */
export const uploadImageFileToGoogle = async (
  imageFile: ImageFile
): Promise<GoogleFileUploadResult> => {
  // Convert base64 to Blob
  const response = await fetch(`data:${imageFile.file.type};base64,${imageFile.base64}`);
  const blob = await response.blob();

  return uploadToGoogleFiles(blob, imageFile.file.name);
};

/**
 * Helper to create a fileData part for API calls (instead of inlineData)
 */
export const createFileDataPart = (fileUri: string, mimeType: string) => ({
  fileData: {
    fileUri,
    mimeType,
  }
});

// Threshold for using Google Files API instead of inline base64
// Vercel has 4.5MB limit, we use 3MB threshold for safety margin
const LARGE_FILE_THRESHOLD = 3 * 1024 * 1024; // 3MB

/**
 * Smart image part creator - uses fileUri for large images, inlineData for small ones
 * This automatically handles the Vercel 4.5MB limit
 */
const createImagePart = async (imageFile: ImageFile): Promise<any> => {
  // Estimate base64 size (roughly 1.37x the binary size)
  const estimatedSize = imageFile.base64.length * 0.75;

  if (estimatedSize > LARGE_FILE_THRESHOLD) {
    // Large file: Upload to Google Files API first
    console.log(`[SmartUpload] Image ${imageFile.file.name} is large (${(estimatedSize / 1024 / 1024).toFixed(2)}MB), using Google Files API`);
    const uploadResult = await uploadImageFileToGoogle(imageFile);
    return {
      fileData: {
        fileUri: uploadResult.fileUri,
        mimeType: uploadResult.mimeType,
      }
    };
  } else {
    // Small file: Use inline base64
    return {
      inlineData: {
        data: imageFile.base64,
        mimeType: imageFile.file.type || 'image/jpeg'
      }
    };
  }
};

/**
 * Process multiple images, uploading large ones to Google Files API
 */
const createImageParts = async (images: ImageFile[]): Promise<any[]> => {
  return Promise.all(images.map(img => createImagePart(img)));
};

// ===========================================
// VIDEO GENERATION (VEO) - Using predictLongRunning API
// ===========================================

interface VeoStartResponse {
  operationName: string;
}

interface VeoStatusResponse {
  done: boolean;
  videoUri?: string;
  error?: string;
}

export const generateVideo = async (
  params: GenerateVideoParams,
  signal: AbortSignal,
  onProgress?: (status: string) => void,
): Promise<{ objectUrl: string; blob: Blob; uri: string; video: any; supabaseUrl?: string }> => {
  // Determine if this is an extension with a valid video reference
  const videoUri = params.mode === GenerationMode.EXTEND_VIDEO && params.inputVideoObject?.uri
    ? params.inputVideoObject.uri
    : undefined;

  // Clear logging for sequence debugging
  if (videoUri) {
    console.log(`[Sequence/Extend] Generating extension with baseVideo=${videoUri}`);
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    console.warn('[Sequence/Extend] WARNING: EXTEND_VIDEO mode but no baseVideo URI! Will generate as text-to-video instead of true extension.');
  } else {
    console.log(`[Sequence] Generating root shot with mode=${params.mode}`);
  }
  console.log('[Veo] Starting video generation...', params);

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING: Please enter your Gemini API key first');
  }

  try {
    // Build parameters for the API
    const parameters: Record<string, any> = {};

    if (params.mode !== GenerationMode.REFERENCES_TO_VIDEO) {
      if (params.resolution) {
        parameters.resolution = params.resolution;
      }
    }

    if (params.mode !== GenerationMode.EXTEND_VIDEO &&
      params.mode !== GenerationMode.REFERENCES_TO_VIDEO) {
      if (params.aspectRatio) {
        parameters.aspectRatio = params.aspectRatio;
      }
    }

    // Build prompt with any necessary instructions
    let finalPrompt = params.prompt;

    if (params.mode === GenerationMode.FRAMES_TO_VIDEO && params.startFrame) {
      const instruction =
        'CRITICAL INSTRUCTION: You are to animate the provided image, NOT reinterpret it. The very first frame of the video MUST be pixel-perfect identical to the provided start image. DO NOT add, remove, or change any characters, objects, or environmental elements present in the image. The composition is fixed. Your only task is to create motion, animating ONLY what is already there.\n\n';
      finalPrompt = instruction + finalPrompt;
    }

    if (!finalPrompt.trim()) {
      if (params.mode === GenerationMode.EXTEND_VIDEO) {
        finalPrompt = 'Continue the scene.';
      } else {
        throw new Error('A prompt description is required.');
      }
    }

    // 1. Start Generation using /api/video/generate endpoint
    onProgress?.('Starting video generation...');
    console.log('[Veo] Calling /api/video/generate...', {
      hasVideoUri: !!videoUri,
      hasStartFrame: !!params.startFrame,
      mode: params.mode
    });

    // Compress startFrame if present to avoid 413 Payload Too Large (Vercel limit ~4.5MB)
    let startFrameBase64 = params.startFrame?.base64;
    if (startFrameBase64) {
      try {
        const originalSize = startFrameBase64.length;
        console.log('[Veo] Compressing startFrame...', { originalSize: `${(originalSize / 1024).toFixed(0)}KB` });

        // compressImageBase64 is defined at the top of this file
        startFrameBase64 = await compressImageBase64(startFrameBase64, 1024, 0.7);

        console.log('[Veo] Compression result:', {
          newSize: `${(startFrameBase64.length / 1024).toFixed(0)}KB`,
          ratio: `${((startFrameBase64.length / originalSize) * 100).toFixed(1)}%`
        });
      } catch (e) {
        console.warn('[Veo] Failed to compress startFrame, sending original (risks 413):', e);
      }
    }

    const startResponse = await fetch(`${API_BASE}/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: params.model,
        prompt: finalPrompt.trim(),
        parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
        // Pass video URI for extend mode (Veo-generated videos)
        videoUri: videoUri,
        // Pass compressed startFrame for external video continuation
        startFrame: startFrameBase64,
      }),
      signal,
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to start video generation: ${startResponse.statusText}`);
    }

    const startData: VeoStartResponse = await startResponse.json();
    const operationName = startData.operationName;
    console.log('[Veo] Operation started:', operationName);

    // 2. Poll until done
    let status: VeoStatusResponse = { done: false };
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes max (5s * 120)

    while (!status.done && pollCount < maxPolls) {
      // Check if aborted
      if (signal.aborted) {
        throw new DOMException('Video generation cancelled', 'AbortError');
      }

      // Wait 5 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 5000));

      pollCount++;
      onProgress?.(`Generating video... (${pollCount * 5}s elapsed)`);
      console.log(`[Veo] Polling... (${pollCount * 5}s elapsed)`);

      const statusResponse = await fetch(
        `${API_BASE}/video/status?name=${encodeURIComponent(operationName)}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
          },
          signal,
        }
      );

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to poll video status: ${statusResponse.statusText}`);
      }

      status = await statusResponse.json();

      if (status.error) {
        throw new Error(status.error);
      }
    }

    if (!status.done) {
      throw new Error('Video generation timed out after 10 minutes');
    }

    if (!status.videoUri) {
      throw new Error('No video URI in response');
    }

    console.log('[Veo] Video ready:', status.videoUri);

    // 3. Download video via proxy
    onProgress?.('Downloading video...');
    console.log('[Veo] Downloading video via proxy...');

    const downloadResponse = await fetch(
      `${API_BASE}/proxy-video?uri=${encodeURIComponent(status.videoUri)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal,
      }
    );

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download video: ${downloadResponse.statusText}`);
    }

    const videoBlob = await downloadResponse.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    console.log('[Veo] Video downloaded:', videoBlob.size, 'bytes');

    // 4. Optional: Upload to Supabase if configured (via Provider)
    let supabaseUrl: string | undefined;

    // Use the Storage Factory to get the best available provider
    const storageProvider = await VideoStorageFactory.getAvailableProvider();

    if (storageProvider) {
      try {
        onProgress?.(`Uploading to storage (${storageProvider.name})...`);
        console.log(`[Veo] Uploading to ${storageProvider.name}...`);

        const filename = `veo-${params.model}-${Date.now()}.mp4`;
        const result = await storageProvider.upload(videoBlob, filename, {
          contentType: 'video/mp4',
          public: true
        });

        supabaseUrl = result.publicUrl;
        console.log(`[Veo] Video uploaded to ${storageProvider.name}:`, supabaseUrl);
      } catch (uploadError) {
        console.warn('[Veo] Failed to upload to storage provider:', uploadError);
        // Don't crash the generation if upload fails, just log it
      }
    } else {
      console.log('[Veo] No storage provider available, skipping upload.');
    }

    return {
      objectUrl,
      blob: videoBlob,
      uri: status.videoUri,
      video: { uri: status.videoUri },
      supabaseUrl,
    };

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error('[Veo] Video Generation Error:', error);
    throw error;
  }
};

// ===========================================
// TEXT / CHAT GENERATION
// ===========================================

export const generatePromptFromImage = async (image: ImageFile): Promise<string> => {
  // Use smart upload for large images
  const imagePart = await createImagePart(image);

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        imagePart,
        { text: 'Describe this image in a creative and detailed way to be used as a prompt for a video generation model. Focus on action, mood, and visual details. The description should be a single, cohesive paragraph.' }
      ]
    }
  });
  return extractText(response).trim();
};

export const generatePromptSequence = async (
  sceneDescription: string,
  totalDuration: number,
  dogma: Dogma | null,
): Promise<PromptSequence> => {
  const remainingDuration = totalDuration - 8;
  const averageExtensionDuration = 5.5;
  const numExtensions = remainingDuration > 0 ? Math.ceil(remainingDuration / averageExtensionDuration) : 0;
  const dogmaText = dogma?.text ?? '';

  const systemPrompt = `You are a master cinematic shot planner. Your task is to take a user's detailed, VEO-optimized prompt for a continuous scene and break it down into a sequence of smaller prompts for the Veo video generation model.
  Rules:
  1. Create a "mainPrompt" (8s).
  2. Create exactly ${numExtensions} "extensionPrompts" (4-7s each).
  3. Ensure seamless continuity.
  4. Follow Dogma: ${dogmaText}
  5. JSON OUTPUT ONLY: { "mainPrompt": "string", "extensionPrompts": ["string"] }`;

  const parts: any[] = [];
  if (dogma?.referenceImages) {
    for (const img of dogma.referenceImages) {
      parts.push({ inlineData: { data: img.base64, mimeType: img.type } });
    }
  }
  parts.push({ text: `Scene: "${sceneDescription}". Duration: ${totalDuration}s.` });

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: { parts },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  try {
    const parsed = JSON.parse(text);
    // Return full PromptSequence structure with defaults for new fields
    const sequence: PromptSequence = {
      id: crypto.randomUUID(),
      dogmaId: dogma?.id ?? null,
      mainPrompt: parsed.mainPrompt,
      extensionPrompts: parsed.extensionPrompts || [],
      status: PromptSequenceStatus.CLEAN,
      dirtyExtensions: [],
      createdAt: new Date().toISOString(),
    };
    return sequence;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        id: crypto.randomUUID(),
        dogmaId: dogma?.id ?? null,
        mainPrompt: parsed.mainPrompt,
        extensionPrompts: parsed.extensionPrompts || [],
        status: PromptSequenceStatus.CLEAN,
        dirtyExtensions: [],
        createdAt: new Date().toISOString(),
      };
    }
    throw new Error('Failed to parse sequence response');
  }
};

// ===========================================
// AUTOMATIC MOTION ANALYSIS (Gemini Vision)
// ===========================================

/**
 * Automatically analyze motion/movement between two video frames using Gemini Vision.
 * Returns a concise description of direction, speed, and trajectory.
 */
export const analyzeMotionBetweenFrames = async (
  firstFrame: ImageFile,
  lastFrame: ImageFile,
): Promise<string> => {
  console.log('[MotionAnalysis] Analyzing motion between frames...');

  const systemPrompt = `You are a video continuity expert. Analyze the motion/movement between these two video frames (first frame and last frame of an 8-second clip).

Describe in 2-3 sentences:
1. The DIRECTION of movement (left-to-right, upward, toward camera, etc.)
2. The SPEED/INTENSITY (slow pan, fast action, static, etc.)
3. Any notable CHANGES (zoom, rotation, subject movement)

Be specific and concise. Use cinematic terminology. Respond in the same language as any visible text, or French by default.`;

  try {
    // Compress images if needed to reduce payload
    let firstBase64 = firstFrame.base64;
    let lastBase64 = lastFrame.base64;

    if (firstBase64.length > 300 * 1024) {
      firstBase64 = await compressImageBase64(firstBase64, 512, 0.6);
    }
    if (lastBase64.length > 300 * 1024) {
      lastBase64 = await compressImageBase64(lastBase64, 512, 0.6);
    }

    const response = await apiCall('/generate-content', {
      model: MODELS.FLASH, // Use faster model for quick analysis
      contents: [{
        role: 'user',
        parts: [
          { text: 'First frame (start of video):' },
          { inlineData: { data: firstBase64, mimeType: 'image/jpeg' } },
          { text: 'Last frame (end of video):' },
          { inlineData: { data: lastBase64, mimeType: 'image/jpeg' } },
        ]
      }],
      config: { systemInstruction: systemPrompt }
    });

    const analysis = extractText(response);
    console.log('[MotionAnalysis] Result:', analysis);
    return analysis;
  } catch (error) {
    console.error('[MotionAnalysis] Failed:', error);
    return ''; // Return empty on error - user can still describe manually
  }
};

export const generateSequenceFromConversation = async (
  messages: ChatMessage[],
  dogma: Dogma | null,
  duration: number,
  extensionContext?: ImageFile | null,
  motionDescription?: string | null,
): Promise<string | { creativePrompt: string; veoOptimizedPrompt: string }> => {

  // Build context instruction based on whether this is an extension
  let contextInstruction = '';
  if (extensionContext) {
    contextInstruction = `User wants to EXTEND a video. Last frame provided as visual anchor.`;
    if (motionDescription) {
      contextInstruction += `\nCONTINUITY CONTEXT (from video analysis): "${motionDescription}"
This describes the movement/direction from the original video that the extension should continue.`;
    }
  } else {
    contextInstruction = `User wants a NEW video. Duration: ${duration}s.`;
  }

  // DEBUG: Log dogma being used
  console.log('[DogmaDebug] generateSequenceFromConversation called with dogma:', {
    id: dogma?.id || 'none',
    title: dogma?.title || 'none',
    textPreview: dogma?.text?.substring(0, 100) + '...' || 'none'
  });

  // === VISUAL-FIRST: Minimal assistant, action-oriented ===
  const systemInstruction = `You are a VISUAL-FIRST video director. Be EXTREMELY concise.

RULES:
- MAX 1-2 sentences response. NO long explanations.
- Ask MAX 2 clarifying questions ONLY if critical info is missing (subject, action, style).
- If user provides enough context, IMMEDIATELY output the JSON prompt.
- End conversational responses with: "🎬 Generating keyframes..."
- Detect user language and respond in same language.

CONTEXT:
- Dogma: ${dogma?.title || 'None'}${dogma?.text ? ` - ${dogma.text.substring(0, 200)}` : ''}
- ${contextInstruction}

OUTPUT FORMAT (when ready):
\`\`\`json
{
  "creativePrompt": "Artistic description for storyboard",
  "veoOptimizedPrompt": "Technical VEO 3.1 prompt with camera, lighting, action"
}
\`\`\`

Example good response: "A lone figure in rain. Cinematic noir. 🎬 Generating keyframes..."
Example bad response: "Great idea! Let me think about this. First, we should consider the lighting..."`;


  // ═══════════════════════════════════════════════════════════════════
  // SANITIZE MESSAGES: Keep only text from history, use ONE visual anchor
  // ═══════════════════════════════════════════════════════════════════

  // Find the visual anchor: prefer extensionContext, else the last image in messages
  let visualAnchor: ImageFile | null = extensionContext || null;
  if (!visualAnchor) {
    // Find the most recent image in the conversation
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].image) {
        visualAnchor = messages[i].image;
        break;
      }
    }
  }

  // Build sanitized API contents: text only from history, anchor image once at the end
  const apiContents: any[] = [];

  // Add text-only versions of all messages (no images in history)
  for (const msg of messages) {
    if (msg.content) {
      apiContents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  // Add visual anchor as a dedicated context message if available
  if (visualAnchor) {
    // Compress image to reduce payload size (Vercel has 4.5MB limit)
    let anchorBase64 = visualAnchor.base64;
    let anchorMimeType = visualAnchor.file.type || 'image/jpeg';

    // If image is larger than 500KB, compress it
    if (anchorBase64.length > 500 * 1024) {
      try {
        console.log('[GenContent] Compressing large anchor image:', `${(anchorBase64.length / 1024).toFixed(1)}KB`);
        const compressed = await compressImageBase64(anchorBase64, 1024, 0.7);
        anchorBase64 = compressed;
        anchorMimeType = 'image/jpeg';
        console.log('[GenContent] Compressed to:', `${(anchorBase64.length / 1024).toFixed(1)}KB`);
      } catch (e) {
        console.warn('[GenContent] Image compression failed, using original:', e);
      }
    }

    apiContents.push({
      role: 'user',
      parts: [
        { text: '[Visual Anchor - Last frame for continuity reference]' },
        {
          inlineData: {
            data: anchorBase64,
            mimeType: anchorMimeType
          }
        }
      ]
    });
  }

  // Log sanitized message summary for debugging
  const totalTextLength = apiContents.reduce((sum, msg) =>
    sum + msg.parts.reduce((s: number, p: any) => s + (p.text?.length || 0), 0), 0);
  const hasAnchorImage = !!visualAnchor;

  console.log('[GenContent] Sanitized messages:', {
    totalMessages: apiContents.length,
    textLength: totalTextLength,
    hasVisualAnchor: hasAnchorImage,
    anchorImageSize: visualAnchor ? `${(visualAnchor.base64.length / 1024).toFixed(1)}KB` : 'none'
  });

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: apiContents,
    config: { systemInstruction }
  });

  const text = extractText(response);

  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;

    if (jsonStr.trim().startsWith('{')) {
      const parsed = JSON.parse(jsonStr);
      if (parsed.creativePrompt && parsed.veoOptimizedPrompt) return parsed;
    }
  } catch (e) {
    console.log("Parsing JSON failed, returning raw text", e);
  }

  return text;
};

// ===========================================
// IMAGE EDITING / GENERATION
// ===========================================

export const editImage = async (
  images: ImageFile[],
  prompt: string,
  dogma: Dogma | null,
  modelName: string = MODELS.IMAGE_FLASH
): Promise<ImageFile> => {
  // Use smart upload for large images
  const imageParts = await createImageParts(images);

  const dogmaInstruction = dogma?.text ? `\nDogma: ${dogma.text}` : '';
  const finalPrompt = `Task: Edit image based on prompt. @image1 is target. Prompt: ${prompt}${dogmaInstruction}`;

  const response = await apiCall('/generate-content', {
    model: modelName,
    contents: {
      parts: [...imageParts, { text: finalPrompt }]
    }
  });

  const content = response.candidates?.[0]?.content;
  if (!content?.parts) throw new Error('No content');

  for (const part of content.parts) {
    if (part.inlineData) {
      const base64 = part.inlineData.data;
      const res = await fetch(`data:image/png;base64,${base64}`);
      const blob = await res.blob();
      const file = new File([blob], 'edited.png', { type: 'image/png' });

      // Optional: Upload to Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          const supabaseUrl = await uploadImageToSupabase(blob, 'edited-image.png');
          console.log('Edited image uploaded to Supabase:', supabaseUrl);
        } catch (uploadError) {
          console.warn('Failed to upload image to Supabase:', uploadError);
        }
      }

      return { file, base64 };
    }
  }
  throw new Error('No image in response');
};

export const generateImageFromText = async (prompt: string, dogma: Dogma | null): Promise<ImageFile> => {
  const dogmaInstruction = dogma?.text ? `\nStyle: ${dogma.text}` : '';

  const response = await apiCall('/generate-content', {
    model: MODELS.IMAGE_PRO,
    contents: { parts: [{ text: prompt + dogmaInstruction }] }
  });

  const content = response.candidates?.[0]?.content;
  for (const part of content.parts) {
    if (part.inlineData) {
      const base64 = part.inlineData.data;
      const res = await fetch(`data:image/png;base64,${base64}`);
      const blob = await res.blob();

      // Optional: Upload to Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          const supabaseUrl = await uploadImageToSupabase(blob, 'generated-image.png');
          console.log('Generated image uploaded to Supabase:', supabaseUrl);
        } catch (uploadError) {
          console.warn('Failed to upload image to Supabase:', uploadError);
        }
      }

      return { file: new File([blob], 'gen.png', { type: 'image/png' }), base64 };
    }
  }
  throw new Error('No image generated');
};

export const generateCharacterImage = async (
  prompt: string,
  contextImages: { file: File; base64: string }[],
  styleImage: ImageFile | null
): Promise<ImageFile> => {
  const parts: any[] = [];

  // Use smart upload for large context images
  for (const img of contextImages) {
    const imageFile: ImageFile = { file: img.file, base64: img.base64 };
    const imagePart = await createImagePart(imageFile);
    parts.push(imagePart);
  }

  // Use smart upload for style image if provided
  if (styleImage) {
    const stylePart = await createImagePart(styleImage);
    parts.push(stylePart);
  }

  parts.push({ text: prompt });

  const response = await apiCall('/generate-content', {
    model: MODELS.IMAGE_PRO,
    contents: { parts }
  });

  const content = response.candidates?.[0]?.content;
  for (const part of content.parts) {
    if (part.inlineData) {
      const base64 = part.inlineData.data;
      const res = await fetch(`data:image/png;base64,${base64}`);
      const blob = await res.blob();

      // Optional: Upload to Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          const supabaseUrl = await uploadImageToSupabase(blob, 'character-image.png');
          console.log('Character image uploaded to Supabase:', supabaseUrl);
        } catch (uploadError) {
          console.warn('Failed to upload image to Supabase:', uploadError);
        }
      }

      return { file: new File([blob], 'char.png', { type: 'image/png' }), base64 };
    }
  }
  throw new Error('No image generated');
};

// ===========================================
// SPEECH (TTS)
// ===========================================

export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  const response = await apiCall('/generate-content', {
    model: MODELS.TTS,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } }
      }
    }
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio data received");
  return audioData;
};

// ===========================================
// STORYBOARD GENERATION
// ===========================================

export const generateStoryboard = async (
  prompt: string,
  dogma: Dogma | null,
  referenceImages: ImageFile[],
  startFrame: ImageFile | null,
  endFrame: ImageFile | null
): Promise<Storyboard> => {
  const parts: any[] = [];

  // Use smart upload for large images
  if (startFrame) {
    const startPart = await createImagePart(startFrame);
    parts.push(startPart);
    parts.push({ text: "Start Frame" });
  }
  if (endFrame) {
    const endPart = await createImagePart(endFrame);
    parts.push(endPart);
    parts.push({ text: "End Frame" });
  }
  for (const img of referenceImages) {
    const refPart = await createImagePart(img);
    parts.push(refPart);
  }

  const systemPrompt = `Create 5-keyframe storyboard JSON for: "${prompt}". Dogma: ${dogma?.text}. Return JSON { "prompt": "", "keyframes": [{ "timestamp": "", "description": "", "imageBase64": "PLACEHOLDER" }] }`;
  parts.push({ text: systemPrompt });

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: { parts },
    config: { responseMimeType: 'application/json' }
  });

  const text = extractText(response);
  const storyboard = JSON.parse(text);

  // Parallel generation for images
  const imagePromises = storyboard.keyframes.map(async (kf: any) => {
    try {
      const img = await generateImageFromText(kf.description, dogma);
      return { ...kf, imageBase64: img.base64 };
    } catch (e) {
      return kf;
    }
  });

  storyboard.keyframes = await Promise.all(imagePromises);
  return storyboard;
};

// ===========================================
// UTILITIES
// ===========================================

export const toggleTranslateText = async (text: string): Promise<string> => {
  const response = await apiCall('/generate-content', {
    model: MODELS.FLASH,
    contents: `Translate to English if French, or French if English: "${text}"`
  });
  const result = extractText(response);
  return result.trim();
};

export const regenerateSinglePrompt = async (
  params: RegeneratePromptParams & {
    dogma: Dogma | null;
    promptBefore?: string;
    promptAfter?: string;
  },
): Promise<string> => {
  const { instruction, promptToRevise, dogma, promptBefore, promptAfter } = params;

  // DEBUG: Log which dogma is being used
  console.log('[DogmaDebug] regenerateSinglePrompt called with dogma:', {
    id: dogma?.id || 'none',
    title: dogma?.title || 'none',
    textPreview: dogma?.text?.substring(0, 100) + '...' || 'none'
  });

  const systemInstruction = `Revise ONE prompt in a sequence. Dogma: ${dogma?.text}.
  Context: Before: "${promptBefore}", After: "${promptAfter}".
  Target: "${promptToRevise}". User Change: "${instruction}".
  Output JSON: { "revisedPrompt": "..." }`;

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: { parts: [{ text: "Revise." }] },
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });
  const text = extractText(response);
  const res = JSON.parse(text);
  return res.revisedPrompt;
};

export const reviseFollowingPrompts = async (
  params: ReviseFollowingPromptsParams,
): Promise<string[]> => {
  const { dogma, promptBefore, editedPrompt, promptsToRevise } = params;
  const systemInstruction = `Continuity Editor. Dogma: ${dogma?.text}.
  Before: ${promptBefore}. EDITED: ${editedPrompt}.
  Old Next Prompts: ${JSON.stringify(promptsToRevise)}.
  Rewrite Next Prompts for continuity. Output JSON: { "revisedPrompts": ["..."] }`;

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: { parts: [{ text: "Fix continuity." }] },
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  const res = JSON.parse(text);
  return res.revisedPrompts || promptsToRevise;
};

export const getRevisionAssistant = async () => {
  return null;
}

export const getRevisionAssistantResponse = async (params: any) => {
  // DEBUG: Log which dogma is being used for revision
  console.log('[DogmaDebug] getRevisionAssistantResponse called with dogma:', {
    id: params.dogma?.id || 'none',
    title: params.dogma?.title || 'none',
    textPreview: params.dogma?.text?.substring(0, 100) + '...' || 'none'
  });

  const res = await generateSequenceFromConversation(
    params.messages,
    params.dogma,
    0,
  );
  if (typeof res === 'string') return res;
  return { isFinalRevision: true, revisedPrompt: res.veoOptimizedPrompt || res.creativePrompt };
};

// ===========================================
// ADVANCED FEATURES
// ===========================================

export const generateDogmaFromMedia = async (
  mediaFile: File,
  mediaBase64: string
): Promise<Omit<Dogma, 'id'>> => {
  const systemPrompt = `You are an expert Art Director. Analyze this media (image or video frame) and extract its "Visual DNA" to create a Dogma for our video generation studio.
  Identify:
  1. Visual Rules (Lighting, Color Palette, Texture, Composition).
  2. Camera Movement style.
  3. Negative Prompts (what to avoid to maintain this style).

  Output JSON ONLY: { "title": "Name of Style", "text": "Detailed markdown instructions...", "referenceImages": [] }
  For the text field, use the structure: ### RULES, ### LIGHTING, ### CAMERA, ### NEGATIVE PROMPT.`;

  // Use smart upload for large media files
  const imageFile: ImageFile = { file: mediaFile, base64: mediaBase64 };
  const mediaPart = await createImagePart(imageFile);

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        mediaPart,
        { text: "Extract DNA." }
      ]
    },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  const res = JSON.parse(text);
  return {
    title: res.title || "Extracted Style",
    text: res.text || "No description generated.",
    referenceImages: []
  };
};

export const analyzeVideoCompliance = async (
  frameBase64: string,
  prompt: string,
  dogma: Dogma | null
): Promise<ComplianceResult> => {
  const dogmaText = dogma?.text || "Standard Cinematic Rules";
  const systemPrompt = `You are the "Critic Agent". Your job is to compare the generated video frame against the User Prompt and the active Dogma.
    Dogma: ${dogmaText}
    Prompt: ${prompt}

    Analyze the image. Does it respect the lighting, style, and content requested?
    Output JSON: { "score": number (0-100), "critique": "Short constructive critique (max 2 sentences).", "revisedPrompt": "An improved version of the prompt to fix the issues (optional)." }`;

  // Create a dummy ImageFile for smart upload handling
  const estimatedSize = frameBase64.length * 0.75;
  let imagePart: any;

  if (estimatedSize > LARGE_FILE_THRESHOLD) {
    // Large frame: Upload to Google Files API first
    console.log(`[SmartUpload] Frame is large (${(estimatedSize / 1024 / 1024).toFixed(2)}MB), using Google Files API`);
    const response = await fetch(`data:image/jpeg;base64,${frameBase64}`);
    const blob = await response.blob();
    const uploadResult = await uploadToGoogleFiles(blob, `frame-${Date.now()}.jpg`);
    imagePart = {
      fileData: {
        fileUri: uploadResult.fileUri,
        mimeType: 'image/jpeg',
      }
    };
  } else {
    // Small frame: Use inline base64
    imagePart = {
      inlineData: { data: frameBase64, mimeType: 'image/jpeg' }
    };
  }

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        imagePart,
        { text: "Critique this." }
      ]
    },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json'
    }
  });

  const text = extractText(response);
  return JSON.parse(text);
};
