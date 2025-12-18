/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Timeline Types - Segment = Objet IA
 * Canonical data model for projects, segments, revisions
 */

// === PROVIDERS ===
export type Provider = 'veo' | 'kling-omni' | 'runway' | 'nano-fast' | 'nano-pro';

// === REVISION STATUS ===
export type RevisionStatus = 'draft' | 'queued' | 'running' | 'succeeded' | 'failed';

// === TIMELINE SETTINGS ===
export type FPS = 24 | 25 | 30;
export type AspectRatio = '16:9' | '9:16' | '1:1';

// === ASSET ===
export interface Asset {
    id: string;
    kind: 'image' | 'video';
    storagePath: string;
    mime: string;
    width?: number;
    height?: number;
    durationSec?: number;
    fileSizeBytes?: number;
    createdAt: string;
    // Computed client-side
    url?: string;
}

// === KEYFRAME ===
export interface Keyframe {
    id: string;
    segmentId: string;
    revisionId: string;
    tSec: number;
    assetId: string;
    note?: string;
    createdAt: string;
    // Joined
    asset?: Asset;
}

// === SEGMENT PROMPT ===
export interface SegmentPrompt {
    rootPrompt: string;
    extendPrompt?: string;
    negativePrompt?: string;
    dogmaId?: string;
    constraints?: Record<string, unknown>;
}

// === SEGMENT REVISION ===
export interface SegmentRevision {
    id: string;
    segmentId: string;
    parentRevisionId?: string;
    provider: Provider;
    status: RevisionStatus;
    promptJson: SegmentPrompt;
    baseAssetId?: string;
    outputAssetId?: string;
    metricsJson?: {
        cost?: number;
        latencyMs?: number;
        matchScore?: number;
    };
    errorJson?: {
        code: string;
        message: string;
        raw?: unknown;
    };
    createdAt: string;
    // Joined
    baseAsset?: Asset;
    outputAsset?: Asset;
    keyframes?: Keyframe[];
}

// === SEGMENT ===
export interface Segment {
    id: string;
    projectId: string;
    order: number;
    inSec: number;
    outSec: number;
    activeRevisionId?: string;
    label?: string;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
    // Computed
    durationSec: number;
    // Joined
    activeRevision?: SegmentRevision;
    revisions?: SegmentRevision[];
}

// === PROJECT ===
export interface Project {
    id: string;
    userId: string;
    title: string;
    fps: FPS;
    aspect: AspectRatio;
    createdAt: string;
    updatedAt: string;
    // Joined
    segments?: Segment[];
}

// === TIMELINE OPERATIONS ===
export type TimelineOp =
    | { type: 'SPLIT'; segmentId: string; atSec: number }
    | { type: 'TRIM_IN'; segmentId: string; inSec: number }
    | { type: 'TRIM_OUT'; segmentId: string; outSec: number }
    | { type: 'MOVE'; segmentId: string; toOrder: number }
    | { type: 'DELETE'; segmentId: string }
    | { type: 'DUPLICATE'; segmentId: string };

// === API PAYLOADS ===

export interface CreateProjectPayload {
    title?: string;
    fps?: FPS;
    aspect?: AspectRatio;
}

export interface CreateSegmentPayload {
    projectId: string;
    label?: string;
    provider?: Provider;
    prompt?: SegmentPrompt;
    baseAssetId?: string;
    durationSec?: number;
}

export interface RenderSegmentPayload {
    segmentId: string;
    provider: Provider;
    revisionId?: string;
    options?: Record<string, unknown>;
}

export interface EditImagePayload {
    segmentId: string;
    revisionId: string;
    baseAssetId: string;
    instruction: string;
    quality: 'fast' | 'pro';
    target: 'shot' | 'cleanup' | 'style';
    dogmaId?: string;
    constraints?: Record<string, unknown>;
}

export interface EditVideoPayload {
    segmentId: string;
    revisionId: string;
    instruction: string;
    provider: 'kling-omni' | 'runway' | 'veo';
    options?: Record<string, unknown>;
}

export interface ExtractKeyframesPayload {
    segmentId: string;
    revisionId: string;
    strategy: 'auto' | 'every_n_sec';
    n?: number;
}

// === UI STATE ===
export type SegmentUIState = 'idle' | 'selected' | 'expanded' | 'locked';

export interface SegmentWithUI extends Segment {
    uiState: SegmentUIState;
    previewingRevisionId?: string;
}

export interface TimelineState {
    project: Project | null;
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    expandedSegmentIds: string[];
    generationQueue: { segmentId: string; revisionId: string }[];
    currentlyGenerating?: { segmentId: string; revisionId: string };
    playheadSec: number;
}
