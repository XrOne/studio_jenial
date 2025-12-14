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

// Model selection
const NANO_BANANA_MODEL = 'gemini-3-pro-image-preview';         // Pro, up to 4K (Standard for Keyframes)
const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image-preview'; // Pro, up to 4K

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
     * Uses Nano Banana (gemini-2.5-flash-image) for speed
     */
    async preview({ baseImage, textPrompt, dogma, constraints }, apiKey) {
        console.log('[NanoBanana] preview: Generating image from prompt');

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
            model: NANO_BANANA_MODEL,
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
     * Uses Nano Banana for fast iteration
     */
    async retouch({ baseImage, instruction, dogma, constraints, target }, apiKey) {
        console.log('[NanoBanana] retouch: Editing image with instruction');

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
            model: NANO_BANANA_MODEL,
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
     * Uses Nano Banana Pro for professional quality
     */
    async shotVariants({ baseImage, shotList, dogma, constraints }, apiKey) {
        console.log('[NanoBananaPro] shotVariants: Generating', shotList?.length, 'variants');

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

                const response = await client.models.generateContent({
                    model: NANO_BANANA_PRO_MODEL,
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
export async function handlePreview(req) {
    const requestId = `nano-prev-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/preview request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, textPrompt, dogma, constraints } = req.body || req;

        if (!textPrompt) {
            return { error: 'textPrompt is required', status: 400 };
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.preview({ baseImage, textPrompt, dogma, constraints });
            return { ...result, requestId, status: 200 };
        } else {
            // Real provider needs API key
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return { error: 'API key required (BYOK or server)', status: 401 };
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key`);

            const result = await provider.preview({ baseImage, textPrompt, dogma, constraints }, apiKey);
            return { ...result, requestId, status: 200 };
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Preview error:`, error.message);
        return { error: error.message, requestId, status: 500 };
    }
}

/**
 * POST /api/nano/retouch
 * Retouch an existing image with an instruction
 */
export async function handleRetouch(req) {
    const requestId = `nano-ret-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/retouch request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, instruction, dogma, constraints, target } = req.body || req;

        if (!baseImage) {
            return { error: 'baseImage is required', status: 400 };
        }
        if (!instruction) {
            return { error: 'instruction is required', status: 400 };
        }
        if (!target || !['root', 'extension', 'character'].includes(target)) {
            return { error: 'target must be root|extension|character', status: 400 };
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.retouch({ baseImage, instruction, dogma, constraints, target });
            return { ...result, requestId, target, status: 200 };
        } else {
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return { error: 'API key required', status: 401 };
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key`);

            const result = await provider.retouch({ baseImage, instruction, dogma, constraints, target }, apiKey);
            return { ...result, requestId, target, status: 200 };
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Retouch error:`, error.message);
        return { error: error.message, requestId, status: 500 };
    }
}

/**
 * POST /api/nano/shot-variants
 * Generate multiple shot variants (camera angles/framings)
 */
export async function handleShotVariants(req) {
    const requestId = `nano-var-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/shot-variants request (mock=${USE_MOCK_PROVIDER})`);

    try {
        const { baseImage, shotList, dogma, constraints } = req.body || req;

        if (!baseImage) {
            return { error: 'baseImage is required', status: 400 };
        }
        if (!shotList || !Array.isArray(shotList) || shotList.length === 0) {
            return { error: 'shotList must be a non-empty array', status: 400 };
        }

        const provider = selectProvider(USE_MOCK_PROVIDER);

        if (USE_MOCK_PROVIDER) {
            const result = await provider.shotVariants({ baseImage, shotList, dogma, constraints });
            return { ...result, requestId, status: 200 };
        } else {
            const { key: apiKey, mode } = getApiKey(req);
            if (!apiKey) {
                return { error: 'API key required', status: 401 };
            }
            console.log(`[Nano:${requestId}] Using ${mode} API key`);

            const result = await provider.shotVariants({ baseImage, shotList, dogma, constraints }, apiKey);
            return { ...result, requestId, status: 200 };
        }
    } catch (error) {
        console.error(`[Nano:${requestId}] Shot variants error:`, error.message);
        return { error: error.message, requestId, status: 500 };
    }
}

// Default export for route handler
export default {
    preview: handlePreview,
    retouch: handleRetouch,
    shotVariants: handleShotVariants,
    _isMock: USE_MOCK_PROVIDER,
    _models: {
        nanoBanana: NANO_BANANA_MODEL,
        nanoBananaPro: NANO_BANANA_PRO_MODEL,
    },
};
