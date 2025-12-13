/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nano Banana Pro API Endpoints
 * 
 * Visual storyboarding APIs for preview generation, retouching, and shot variants.
 * Uses mock provider behind flag for development.
 */

// Feature flag for mock mode
const USE_MOCK_PROVIDER = process.env.NANO_MOCK_MODE === 'true' || true; // Default to mock

// ============================================================================
// MOCK PROVIDER (Development / Testing)
// ============================================================================

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

const mockProvider = {
    /**
     * Generate a preview image from text prompt
     */
    async preview({ baseImage, textPrompt, dogma, constraints }) {
        await mockDelay();
        console.log('[NanoMock] preview called with:', {
            hasBaseImage: !!baseImage,
            promptLength: textPrompt?.length,
            hasDogma: !!dogma
        });

        // Return mock response - in production, this would call Gemini image gen
        return {
            previewImage: baseImage || null, // Echo back base image for mock
            previewPrompt: textPrompt || 'Mock generated prompt',
            cameraNotes: 'Plan moyen, 35mm, f/2.8',
            movementNotes: 'Dolly-in lent, légère rotation',
        };
    },

    /**
     * Retouch an existing image with specific instruction
     */
    async retouch({ baseImage, instruction, dogma, constraints, target }) {
        await mockDelay();
        console.log('[NanoMock] retouch called:', {
            target,
            instructionLength: instruction?.length,
            hasDogma: !!dogma
        });

        return {
            previewImage: baseImage, // Echo back for mock
            previewPrompt: `[${target}] ${instruction}`,
            cameraNotes: 'Recalibrated: Plan taille, axe 3/4',
            movementNotes: 'Static shot, légère respiration',
        };
    },

    /**
     * Generate multiple shot variants from a single image
     */
    async shotVariants({ baseImage, shotList, dogma, constraints }) {
        await mockDelay();
        console.log('[NanoMock] shotVariants called:', {
            numShots: shotList?.length,
            hasDogma: !!dogma
        });

        // Return mock variants
        const variants = (shotList || []).map(label => ({
            label,
            previewImage: baseImage, // Echo for mock
            cameraNotes: `Mock ${label}: 35mm, f/2.8`,
            deltaInstruction: `Convert to ${label}`,
        }));

        return { variants };
    },
};

// ============================================================================
// REAL PROVIDER (Production - Gemini)
// ============================================================================

const realProvider = {
    async preview({ baseImage, textPrompt, dogma, constraints }) {
        // TODO: Implement real Gemini call
        // Use editImage or generateImageFromText from geminiService
        throw new Error('Real provider not implemented yet');
    },

    async retouch({ baseImage, instruction, dogma, constraints, target }) {
        // TODO: Implement real Gemini call
        throw new Error('Real provider not implemented yet');
    },

    async shotVariants({ baseImage, shotList, dogma, constraints }) {
        // TODO: Batch generate using Gemini Pro Image
        throw new Error('Real provider not implemented yet');
    },
};

// Select provider based on flag
const provider = USE_MOCK_PROVIDER ? mockProvider : realProvider;

// ============================================================================
// EXPORTED API HANDLERS
// ============================================================================

/**
 * POST /api/nano/preview
 * Generate a preview image from prompt
 */
export async function handlePreview(req) {
    const requestId = `nano-prev-${Date.now()}`;
    console.log(`[Nano:${requestId}] /api/nano/preview request`);

    try {
        const { baseImage, textPrompt, dogma, constraints } = req.body || req;

        if (!textPrompt) {
            return { error: 'textPrompt is required', status: 400 };
        }

        const result = await provider.preview({ baseImage, textPrompt, dogma, constraints });
        return { ...result, requestId, status: 200 };
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
    console.log(`[Nano:${requestId}] /api/nano/retouch request`);

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

        const result = await provider.retouch({ baseImage, instruction, dogma, constraints, target });
        return { ...result, requestId, target, status: 200 };
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
    console.log(`[Nano:${requestId}] /api/nano/shot-variants request`);

    try {
        const { baseImage, shotList, dogma, constraints } = req.body || req;

        if (!baseImage) {
            return { error: 'baseImage is required', status: 400 };
        }
        if (!shotList || !Array.isArray(shotList) || shotList.length === 0) {
            return { error: 'shotList must be a non-empty array', status: 400 };
        }

        const result = await provider.shotVariants({ baseImage, shotList, dogma, constraints });
        return { ...result, requestId, status: 200 };
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
};
