/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Studio Jenial - Gemini Service
 * BYOK Mode: All API calls use the user's own API key
 */

import {
  ChatMessage,
  ComplianceResult,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  PromptSequence,
  RegeneratePromptParams,
  ReviseFollowingPromptsParams,
  Storyboard,
  VeoModel,
  VideoFile,
} from '../types';
import {
  isSupabaseConfigured,
  uploadVideoToSupabase,
  uploadImageToSupabase
} from './supabaseClient';

// ===========================================
// MODEL CONFIGURATION - Latest Google Models (Nov 2025)
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
// API KEY MANAGEMENT (BYOK)
// ===========================================

export const getApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  const storedKey = window.localStorage.getItem('gemini_api_key');
  return storedKey || '';
};

export const hasCustomApiKey = (): boolean => {
  if (typeof window === 'undefined') return false;
  const storedKey = window.localStorage.getItem('gemini_api_key');
  return !!(storedKey && storedKey.trim() !== '' && storedKey.startsWith('AIza'));
};

// ===========================================
// API CALL HELPER
// ===========================================

const API_BASE = '/api';
const GOOGLE_FILES_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

const apiCall = async (endpoint: string, body: any) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('API_KEY_MISSING: Please enter your Gemini API key first');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Request Failed: ${res.status}`);
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
 * Upload a file directly to Google Files API (client-side, no Vercel limit)
 * This uses a resumable upload protocol for reliability with large files
 * @param file - File or Blob to upload
 * @param displayName - Optional display name for the file
 * @returns fileUri that can be used with Gemini/Veo APIs
 */
export const uploadToGoogleFiles = async (
  file: File | Blob,
  displayName?: string
): Promise<GoogleFileUploadResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING: Please enter your Gemini API key first');
  }

  const mimeType = file instanceof File ? file.type : 'application/octet-stream';
  const fileName = displayName || (file instanceof File ? file.name : `upload-${Date.now()}`);
  const numBytes = file.size;

  console.log(`[GoogleFiles] Starting upload: ${fileName} (${(numBytes / 1024 / 1024).toFixed(2)} MB)`);

  // Step 1: Initialize resumable upload
  const initResponse = await fetch(`${GOOGLE_FILES_API}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': numBytes.toString(),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file: { displayName: fileName }
    }),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Failed to initialize upload: ${initResponse.status} - ${errorText}`);
  }

  // Get the upload URL from the response header
  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL received from Google Files API');
  }

  console.log('[GoogleFiles] Upload URL received, uploading file...');

  // Step 2: Upload the actual file
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
    console.log('[Veo] Calling /api/video/generate...');

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

    // 4. Optional: Upload to Supabase if configured
    let supabaseUrl: string | undefined;
    if (isSupabaseConfigured()) {
      try {
        onProgress?.('Uploading to storage...');
        console.log('[Veo] Uploading to Supabase...');
        supabaseUrl = await uploadVideoToSupabase(videoBlob, `veo-${params.model}-${Date.now()}.mp4`) || undefined;
        console.log('[Veo] Video uploaded to Supabase:', supabaseUrl);
      } catch (uploadError) {
        console.warn('[Veo] Failed to upload to Supabase:', uploadError);
      }
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
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse sequence response');
  }
};

export const generateSequenceFromConversation = async (
  messages: ChatMessage[],
  dogma: Dogma | null,
  duration: number,
  extensionContext?: ImageFile | null,
): Promise<string | { creativePrompt: string; veoOptimizedPrompt: string }> => {

  const contextInstruction = extensionContext
    ? `User wants to EXTEND a video. Last frame provided.`
    : `User wants a NEW video. Duration: ${duration}s.`;

  const systemInstruction = `You are "Prompt Guardian", expert AI video director.
  Goal: Help user create VEO 3.1 video prompt. Follow Dogma: ${dogma?.title || 'None'}.
  ${contextInstruction}
  Step 1: Creative Conversation.
  Step 2: When ready, output strictly JSON: { "creativePrompt": "...", "veoOptimizedPrompt": "..." }
  Detect user language and respond in same language.`;

  // Map internal ChatMessage to API Content
  const apiContents = messages.map(msg => {
    const parts: any[] = [];
    if (msg.content) parts.push({ text: msg.content });
    if (msg.image) {
      parts.push({
        inlineData: {
          data: msg.image.base64,
          mimeType: msg.image.file.type || 'image/jpeg'
        }
      });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts
    };
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
