/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nano Banana Pro API Endpoints
 * 
 * Visual storyboarding APIs for preview generation, retouching, and shot variants.
 * Uses Gemini 2.5 Flash Image (Nano Banana) and Gemini 3 Pro Image (Nano Banana Pro).
 * 
 * Models:
 * - gemini-2.5-flash-image (Nano Banana): Fast, 1024px, good for quick iterations
 * - gemini-3-pro-image-preview (Nano Banana Pro): Pro, up to 4K, reasoning, Google Search grounding
 */

import { GoogleGenAI } from '@google/genai';

// Feature flag for mock mode
const USE_MOCK_PROVIDER = process.env.NANO_MOCK_MODE === 'true';

// Model selection - quality-aware
// PRO = High quality for final keyframes sent to Veo
// FAST = Quick previews for iterative refinement
const NANO_PRO_MODEL = 'gemini-3-pro-image-preview';   // Pro, up to 4K (for root keyframes → Veo)
const NANO_FAST_MODEL = 'gemini-2.5-flash-image';      // Fast, 1024px (for quick previews)

/**
 * Get model based on quality param
 * @param {string} quality - 'pro' | 'fast'
 * @param {string} target - 'root' | 'extension' | 'character'
 * @returns {string} Model name
 */
function getModelForQuality(quality, target) {
    // Root keyframes default to PRO for Veo quality
    if (!quality && target === 'root') {
        quality = 'pro';
    }

    // Explicit quality selection
    const model = quality === 'fast' ? NANO_FAST_MODEL : NANO_PRO_MODEL;
    console.log(`[Nano] quality=${quality || 'default'} target=${target} model=${model}`);
    return model;
}

// ============================================================================
// MOCK PROVIDER (Development / Testing)
// ============================================================================

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

const mockProvider = {
    async preview({ baseImage, textPrompt, dogma, constraints }) {
        await mockDelay();
        console.log('[NanoMock] preview called with:', {
            hasBaseImage: !!baseImage,
            promptLength: textPrompt?.length,
            hasDogma: !!dogma
        });

        // Generate a small placeholder image if no baseImage provided
        // This is a tiny 100x100 gradient PNG in base64
        const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAACXBIWXMAAAsTAAALEwEAmpwYAAABhUlEQVR4nO3SMQ0AAAgEsAf/nkMFFJJYONTJfuVuCQAAAAAAAAAAAAAAAMD/1Z4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4u+oOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA6g4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+g4AAAAAAAAAAAAAAPD/qj0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+rroDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACou0MAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8P/VHgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

        return {
            previewImage: baseImage || { base64: placeholderBase64, file: null },
            previewPrompt: textPrompt || 'Mock generated prompt',
            cameraNotes: 'Plan moyen, 35mm, f/2.8',
            movementNotes: 'Dolly-in lent, légère rotation',
        };
    },

    async retouch({ baseImage, instruction, dogma, constraints, target }) {
        await mockDelay();
        console.log('[NanoMock] retouch called:', {
            target,
            instructionLength: instruction?.length,
            hasDogma: !!dogma
        });

        return {
            previewImage: baseImage,
            previewPrompt: `[${target}] ${instruction}`,
            cameraNotes: 'Recalibrated: Plan taille, axe 3/4',
            movementNotes: 'Static shot, légère respiration',
        };
    },

    async shotVariants({ baseImage, shotList, dogma, constraints }) {
        await mockDelay();
        console.log('[NanoMock] shotVariants called:', {
            numShots: shotList?.length,
            hasDogma: !!dogma
        });

        const variants = (shotList || []).map(label => ({
            label,
            previewImage: baseImage,
            cameraNotes: `Mock ${label}: 35mm, f/2.8`,
            deltaInstruction: `Convert to ${label}`,
        }));

        return { variants };
    },
};

// ============================================================================
// REAL PROVIDER (Production - Gemini Nano Banana / Nano Banana Pro)
// ============================================================================

/**
 * Get API key from request or environment
 * BYOK support: check headers first, then fallback to server key
 */
function getApiKey(req) {
    // BYOK: Check for client-provided key
    const clientKey = req?.headers?.['x-gemini-api-key'];
    if (clientKey) {
        return { key: clientKey, mode: 'BYOK' };
    }
    // Server-managed key
    const serverKey = process.env.GEMINI_API_KEY;
    if (serverKey) {
        return { key: serverKey, mode: 'SERVER' };
    }
    return { key: null, mode: 'NONE' };
}

/**
 * Create Gemini client
 */
function createClient(apiKey) {
    return new GoogleGenAI({ apiKey });
}

/**
 * Convert image to Gemini-compatible format
 */
function imageToGeminiPart(imageData) {
    // imageData can be { base64, file } or just base64 string
    const base64 = typeof imageData === 'string' ? imageData : imageData?.base64;
    if (!base64) return null;

    return {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64,
        },
    };
}

/**
 * Extract image from Gemini response
 */
function extractImageFromResponse(response) {
    const parts = response?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
        if (part.inlineData) {
            return {
                base64: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/jpeg',
            };
        }
    }
    return null;
}

/**
 * Extract text from Gemini response
 */
function extractTextFromResponse(response) {
    const parts = response?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
        if (part.text) {
            return part.text;
        }
    }
    return null;
}

/**
 * Build dogma context string
 */
function buildDogmaContext(dogma) {
    if (!dogma) return '';

    const parts = [];
    if (dogma.name) parts.push(`Style: ${dogma.name}`);
    if (dogma.visualIdentity) parts.push(`Visual identity: ${dogma.visualIdentity}`);
    if (dogma.colorPalette) parts.push(`Colors: ${dogma.colorPalette}`);
    if (dogma.cameraStyle) parts.push(`Camera: ${dogma.cameraStyle}`);
    if (dogma.lightingNotes) parts.push(`Lighting: ${dogma.lightingNotes}`);

    return parts.length > 0 ? `\n\n[Dogma Context]\n${parts.join('\n')}` : '';
}

const realProvider = {
    /**
     * Generate a preview image from text prompt
     * Uses quality-aware model selection
     */
    async preview({ baseImage, textPrompt, dogma, constraints, quality, target }, apiKey) {
        const model = getModelForQuality(quality, target || 'root');
        console.log(`[NanoBanana] preview: Generating image from prompt (model=${model})`);

        const client = createClient(apiKey);

        // Build prompt with dogma context
        const fullPrompt = `${textPrompt}${buildDogmaContext(dogma)}`;

        let contents;
        if (baseImage) {
            // Image + text -> image (editing)
            const imagePart = imageToGeminiPart(baseImage);
            contents = [
                { text: fullPrompt },
                imagePart,
            ];
        } else {
            // Text -> image (generation)
            contents = [{ text: fullPrompt }];
        }

        const response = await client.models.generateContent({
            model,
            contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });
        const generatedImage = extractImageFromResponse(response);
        const generatedText = extractTextFromResponse(response);

        if (!generatedImage) {
            throw new Error('No image generated by Nano Banana');
        }

        return {
            previewImage: { base64: generatedImage.base64 },
            previewPrompt: generatedText || textPrompt,
            cameraNotes: null,
            movementNotes: null,
        };
    },

    /**
     * Retouch an existing image with specific instruction
     * Uses quality-aware model selection
     */
    async retouch({ baseImage, instruction, dogma, constraints, target, quality }, apiKey) {
        const model = getModelForQuality(quality, target);
        console.log(`[NanoBanana] retouch: Editing image with instruction (model=${model})`);

        const client = createClient(apiKey);

        // Build instruction with dogma context
        const fullInstruction = `${instruction}${buildDogmaContext(dogma)}`;

        const imagePart = imageToGeminiPart(baseImage);
        if (!imagePart) {
            throw new Error('Invalid baseImage format');
        }

        const contents = [
            { text: fullInstruction },
            imagePart,
        ];

        const response = await client.models.generateContent({
            model,
            contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });
        const generatedImage = extractImageFromResponse(response);
        const generatedText = extractTextFromResponse(response);

        if (!generatedImage) {
            throw new Error('No image generated during retouch');
        }

        return {
            previewImage: { base64: generatedImage.base64 },
            previewPrompt: generatedText || instruction,
            cameraNotes: null,
            movementNotes: null,
        };
    },

    /**
     * Generate multiple shot variants (camera angles/framings)
     * Uses fast model for bulk generation (12 thumbnails)
     */
    async shotVariants({ baseImage, shotList, dogma, constraints, quality }, apiKey) {
        // Default to fast for shot variants (12 thumbnails)
        const model = getModelForQuality(quality || 'fast', 'extension');
        console.log(`[NanoBananaPro] shotVariants: Generating ${shotList?.length} variants (model=${model})`);

        const client = createClient(apiKey);

        const imagePart = imageToGeminiPart(baseImage);
        if (!imagePart) {
            throw new Error('Invalid baseImage format');
        }

        const dogmaContext = buildDogmaContext(dogma);
        const variants = [];

        // Generate each variant sequentially
        // Note: Could be parallelized but may hit rate limits
        for (const label of shotList) {
            try {
                const instruction = `Transform this image into a ${label}. Maintain the same subject and scene, but adjust the camera framing, angle, and composition to match the "${label}" shot type. Keep the visual style consistent.${dogmaContext}`;

                const contents = [
                    { text: instruction },
                    imagePart,
                ];

                const modelName = getModelForQuality(quality);
                const response = await client.models.generateContent({
                    model: modelName,
                    contents,
                    config: {
                        responseModalities: ['TEXT', 'IMAGE'],
                    },
                });
                const generatedImage = extractImageFromResponse(response);

                if (generatedImage) {
                    variants.push({
                        label,
                        previewImage: { base64: generatedImage.base64 },
                        cameraNotes: label,
                        deltaInstruction: instruction,
                    });
                } else {
                    console.warn(`[NanoBananaPro] No image for variant: ${label}`);
                    variants.push({
                        label,
                        previewImage: null,
                        cameraNotes: label,
                        deltaInstruction: `Failed: ${label}`,
                    });
                }
            } catch (err) {
                console.error(`[NanoBananaPro] Error generating ${label}:`, err.message);
                variants.push({
                    label,
                    previewImage: null,
                    cameraNotes: label,
                    deltaInstruction: `Error: ${err.message}`,
                });
            }
        }

        return { variants };
    },
};

// Select provider based on flag
const selectProvider = (useMock) => useMock ? mockProvider : realProvider;

// ============================================================================
// EXPORTED API HANDLERS
// ============================================================================

/**
 * POST /api/nano/preview
 * Generate a preview image from prompt
 */
export async function handlePreview(req, res) {
    const requestId = `nano-prev-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/preview request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, textPrompt, dogma, constraints, quality, target } = req.body;

        if (!textPrompt) {
            return res.status(400).json({ error: 'textPrompt is required' });
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.preview({ baseImage, textPrompt, dogma, constraints, quality, target });
            return res.status(200).json({ ...result, requestId });
        } else {
            // Real provider needs API key
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ error: 'API key required (BYOK or server)' });
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key, quality=${quality || 'default'}`);

            const result = await provider.preview({ baseImage, textPrompt, dogma, constraints, quality, target }, apiKey);
            return res.status(200).json({ ...result, requestId });
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Preview error:`, error.message);
        return res.status(500).json({ error: error.message, requestId });
    }
}

/**
 * POST /api/nano/retouch
 * Retouch an existing image with an instruction
 */
export async function handleRetouch(req, res) {
    const requestId = `nano-ret-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/retouch request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, instruction, dogma, constraints, target, quality } = req.body;

        if (!baseImage) {
            return res.status(400).json({ error: 'baseImage is required' });
        }
        if (!instruction) {
            return res.status(400).json({ error: 'instruction is required' });
        }
        if (!target || !['root', 'extension', 'character'].includes(target)) {
            return res.status(400).json({ error: 'target must be root|extension|character' });
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.retouch({ baseImage, instruction, dogma, constraints, target, quality });
            return res.status(200).json({ ...result, requestId, target });
        } else {
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ error: 'API key required' });
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key, quality=${quality || 'default'}`);

            const result = await provider.retouch({ baseImage, instruction, dogma, constraints, target, quality }, apiKey);
            return res.status(200).json({ ...result, requestId, target });
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Retouch error:`, error.message);
        return res.status(500).json({ error: error.message, requestId });
    }
}

/**
 * POST /api/nano/shot-variants
 * Generate multiple shot variants (camera angles/framings)
 */
export async function handleShotVariants(req, res) {
    const requestId = `nano-var-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/shot-variants request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, shotList, dogma, constraints, quality } = req.body;

        if (!baseImage) {
            return res.status(400).json({ error: 'baseImage is required' });
        }
        if (!shotList || !Array.isArray(shotList) || shotList.length === 0) {
            return res.status(400).json({ error: 'shotList must be a non-empty array' });
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.shotVariants({ baseImage, shotList, dogma, constraints, quality });
            return res.status(200).json({ ...result, requestId });
        } else {
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ error: 'API key required' });
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key, quality=${quality || 'default'}`);

            const result = await provider.shotVariants({ baseImage, shotList, dogma, constraints, quality }, apiKey);
            return res.status(200).json({ ...result, requestId });
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Shot variants error:`, error.message);
        return res.status(500).json({ error: error.message, requestId });
    }
}

// Default export for route handler
export default {
    preview: handlePreview,
    retouch: handleRetouch,
    shotVariants: handleShotVariants,
    _isMock: USE_MOCK_PROVIDER,
    _models: {
        nanoBanana: NANO_FAST_MODEL,
        nanoBananaPro: NANO_PRO_MODEL,
    },
};
