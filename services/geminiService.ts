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
// VIDEO GENERATION (VEO)
// ===========================================

export const generateVideo = async (
  params: GenerateVideoParams,
  signal: AbortSignal,
): Promise<{ objectUrl: string; blob: Blob; uri: string; video: any; supabaseUrl?: string }> => {
  console.log('Starting video generation...', params);

  try {
    const config: any = {
      numberOfVideos: 1,
    };

    if (params.mode !== GenerationMode.REFERENCES_TO_VIDEO) {
      config.resolution = params.resolution;
    }

    if (
      params.mode !== GenerationMode.EXTEND_VIDEO &&
      params.mode !== GenerationMode.REFERENCES_TO_VIDEO
    ) {
      config.aspectRatio = params.aspectRatio;
    }

    const payload: any = {
      model: params.model,
      config: config,
    };

    let finalPrompt = params.prompt;

    // Build payload based on mode
    if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
      if (params.startFrame) {
        payload.image = {
          imageBytes: params.startFrame.base64,
          mimeType: params.startFrame.file.type || 'image/jpeg',
        };
        const instruction =
          'CRITICAL INSTRUCTION: You are to animate the provided image, NOT reinterpret it. The very first frame of the video MUST be pixel-perfect identical to the provided start image. DO NOT add, remove, or change any characters, objects, or environmental elements present in the image. The composition is fixed. Your only task is to create motion, animating ONLY what is already there.\n\n';
        finalPrompt = instruction + finalPrompt;
      }

      const finalEndFrame = params.isLooping ? params.startFrame : params.endFrame;
      if (finalEndFrame) {
        payload.config.lastFrame = {
          imageBytes: finalEndFrame.base64,
          mimeType: finalEndFrame.file.type || 'image/jpeg',
        };
      }
    } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
      const referenceImagesPayload: any[] = [];
      if (params.referenceImages) {
        for (const img of params.referenceImages) {
          referenceImagesPayload.push({
            image: {
              imageBytes: img.base64,
              mimeType: img.file.type || 'image/jpeg',
            },
            referenceType: 'ASSET',
          });
        }
      }
      if (params.styleImage) {
        referenceImagesPayload.push({
          image: {
            imageBytes: params.styleImage.base64,
            mimeType: params.styleImage.file.type || 'image/jpeg',
          },
          referenceType: 'STYLE',
        });
      }
      if (referenceImagesPayload.length > 0) {
        payload.config.referenceImages = referenceImagesPayload;
      }
    } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
      if (params.inputVideoObject) {
        payload.video = params.inputVideoObject;
      } else {
        throw new Error('An input video object is required to extend a video.');
      }
    }

    if (finalPrompt.trim()) {
      payload.prompt = finalPrompt.trim();
    } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
      payload.prompt = 'Continue the scene.';
    } else {
      throw new Error('A prompt description is required.');
    }

    // 1. Start Generation using new API structure
    const response = await apiCall('/generate-videos', payload);
    console.log('✅ [Veo] API Response:', JSON.stringify(response, null, 2));

    // 2. Extract video from response (new structure from generate_content)
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No video generated - API returned empty candidates');
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('No content in API response');
    }

    const videoPart = candidate.content.parts.find((part: any) => part.video);
    if (!videoPart || !videoPart.video || !videoPart.video.uri) {
      throw new Error('No video URI in response');
    }

    const videoUri = videoPart.video.uri;
    console.log('✅ [Veo] Video URI:', videoUri);

    // 3. Fetch Video via Proxy
    const apiKey = getApiKey();
    const res = await fetch(`${API_BASE}/proxy-video?uri=${encodeURIComponent(videoUri)}`, {
      signal,
      headers: { 'x-api-key': apiKey }
    });

    if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`);

    const videoBlob = await res.blob();
    const objectUrl = URL.createObjectURL(videoBlob);

    // Optional: Upload to Supabase if configured
    let supabaseUrl: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        console.log('Uploading video to Supabase...');
        supabaseUrl = await uploadVideoToSupabase(videoBlob, `veo-${params.model}-${Date.now()}.mp4`);
        console.log('Video uploaded to Supabase:', supabaseUrl);
      } catch (uploadError) {
        console.warn('Failed to upload to Supabase (continuing anyway):', uploadError);
        // Don't fail the whole operation if Supabase upload fails
      }
    }

    return {
      objectUrl,
      blob: videoBlob,
      uri: videoUri,
      video: videoPart.video,
      supabaseUrl
    };

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    console.error('Video Generation Error:', error);
    throw error;
  }
};

// ===========================================
// TEXT / CHAT GENERATION
// ===========================================

export const generatePromptFromImage = async (image: ImageFile): Promise<string> => {
  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        { inlineData: { data: image.base64, mimeType: image.file.type || 'image/jpeg' } },
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
  const imageParts = images.map(img => ({
    inlineData: { data: img.base64, mimeType: img.file.type || 'image/jpeg' }
  }));

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
  contextImages.forEach(img => parts.push({
    inlineData: { data: img.base64, mimeType: img.file.type }
  }));
  if (styleImage) {
    parts.push({
      inlineData: { data: styleImage.base64, mimeType: styleImage.file.type }
    });
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
  if (startFrame) parts.push({ inlineData: { data: startFrame.base64, mimeType: startFrame.file.type }, text: "Start Frame" });
  if (endFrame) parts.push({ inlineData: { data: endFrame.base64, mimeType: endFrame.file.type }, text: "End Frame" });
  referenceImages.forEach(img => parts.push({ inlineData: { data: img.base64, mimeType: img.file.type } }));

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

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        { inlineData: { data: mediaBase64, mimeType: mediaFile.type } },
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

  const response = await apiCall('/generate-content', {
    model: MODELS.PRO,
    contents: {
      parts: [
        { inlineData: { data: frameBase64, mimeType: 'image/jpeg' } },
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
