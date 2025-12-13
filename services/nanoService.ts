/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Nano Banana Pro Service
 * 
 * Frontend service for visual storyboarding - preview generation, retouching, shot variants.
 * All calls go through backend API (BYOK-safe).
 */

import { Dogma, ImageFile, ShotVariant, StoryboardPreview } from '../types';

// Types for API requests/responses
export interface NanoPreviewRequest {
    baseImage?: ImageFile | null;
    textPrompt: string;
    dogma?: Dogma | null;
    constraints?: Record<string, unknown>;
}

export interface NanoPreviewResponse {
    previewImage: ImageFile | null;
    previewPrompt: string;
    cameraNotes?: string;
    movementNotes?: string;
    requestId: string;
}

export interface NanoRetouchRequest {
    baseImage: ImageFile;
    instruction: string;
    dogma?: Dogma | null;
    constraints?: Record<string, unknown>;
    target: 'root' | 'extension' | 'character';
    segmentIndex?: number;  // 0=root, 1..n=extensions
}

export interface NanoRetouchResponse {
    previewImage: ImageFile;
    previewPrompt: string;
    cameraNotes?: string;
    movementNotes?: string;
    requestId: string;
    target: string;
}

export interface NanoShotVariantsRequest {
    baseImage: ImageFile;
    shotList: string[];
    dogma?: Dogma | null;
    constraints?: Record<string, unknown>;
}

export interface NanoShotVariantsResponse {
    variants: ShotVariant[];
    requestId: string;
}

// ============================================================================
// API CALLS (via backend for BYOK safety)
// ============================================================================

const API_BASE = '/api/nano';

async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Generate a preview image from text prompt
 * Used for: initial storyboard visualization
 */
export async function generatePreview(request: NanoPreviewRequest): Promise<NanoPreviewResponse> {
    console.log('[NanoService] generatePreview', {
        hasImage: !!request.baseImage,
        promptLength: request.textPrompt?.length
    });
    return apiCall<NanoPreviewResponse>('/preview', request);
}

/**
 * Retouch an existing image with an instruction
 * Used for: drift correction, camera angle adjustment
 * 
 * CRITICAL: Always pass the correct segmentIndex to avoid root/extension confusion!
 * - segmentIndex=0 means root prompt
 * - segmentIndex=1..n means extension prompts
 */
export async function retouchImage(request: NanoRetouchRequest): Promise<NanoRetouchResponse> {
    console.log('[NanoService] retouchImage', {
        target: request.target,
        segmentIndex: request.segmentIndex,
        instructionLength: request.instruction?.length
    });

    // Validate segmentIndex for extensions
    if (request.target === 'extension' && (request.segmentIndex === undefined || request.segmentIndex < 1)) {
        console.warn('[NanoService] Extension retouch without valid segmentIndex!');
    }

    return apiCall<NanoRetouchResponse>('/retouch', request);
}

/**
 * Generate multiple shot variants from a single image
 * Used for: "Couverture de plans" feature
 */
export async function generateShotVariants(request: NanoShotVariantsRequest): Promise<NanoShotVariantsResponse> {
    console.log('[NanoService] generateShotVariants', {
        numShots: request.shotList?.length
    });
    return apiCall<NanoShotVariantsResponse>('/shot-variants', request);
}

// ============================================================================
// HELPER: Get effective dogma (sequence-bound takes precedence)
// ============================================================================

/**
 * Get the effective dogma for Nano operations.
 * ALWAYS use this to avoid using wrong dogma!
 * 
 * Rule: sequenceBoundDogma ?? activeDogma
 */
export function getEffectiveDogma(
    sequenceBoundDogma: Dogma | null | undefined,
    activeDogma: Dogma | null | undefined
): Dogma | null {
    const effective = sequenceBoundDogma ?? activeDogma ?? null;

    if (sequenceBoundDogma && activeDogma && sequenceBoundDogma.id !== activeDogma.id) {
        console.log('[NanoService] Using sequenceBoundDogma over global activeDogma', {
            sequenceBound: sequenceBoundDogma.id,
            active: activeDogma.id,
        });
    }

    return effective;
}

// ============================================================================
// HELPER: Derive target from segment index (avoids off-by-one bugs)
// ============================================================================

/**
 * Derive target type from segment index.
 * CRITICAL: Use this everywhere to avoid root/extension confusion!
 * 
 * Convention:
 * - null → character (not in sequence)
 * - 0 → root
 * - 1..N → extension
 */
export function deriveTarget(segmentIndex: number | null): 'root' | 'extension' | 'character' {
    if (segmentIndex === null) return 'character';
    if (segmentIndex === 0) return 'root';
    return 'extension';
}

/**
 * Derive dirty extension indices when root is modified.
 * CRITICAL: Returns [1..N] (1-indexed extensions), NOT [0..N-1]!
 * 
 * @param extensionsCount Number of extensions (extensionPrompts.length)
 */
export function deriveDirtyExtensions(extensionsCount: number): number[] {
    // Extensions are indexed 1..N (root is 0)
    return Array.from({ length: extensionsCount }, (_, i) => i + 1);
}

// ============================================================================
// HELPER: Create StoryboardPreview from nano response
// ============================================================================

export function createStoryboardPreview(
    response: NanoPreviewResponse | NanoRetouchResponse,
    owner: 'root' | 'extension' | 'character',
    segmentIndex?: number,
    characterId?: string,
    baseImage?: ImageFile
): StoryboardPreview {
    return {
        id: crypto.randomUUID(),
        owner,
        segmentIndex,
        characterId,
        baseImage,
        previewImage: response.previewImage as ImageFile,
        previewPrompt: response.previewPrompt,
        cameraNotes: response.cameraNotes,
        movementNotes: response.movementNotes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
