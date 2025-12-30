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
export const DEFAULT_FPS = 25;
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
    provider?: Provider;
    status: RevisionStatus;
    promptJson?: SegmentPrompt;
    // For generated content
    baseAssetId?: string;
    outputAssetId?: string;
    // For imported media
    videoUrl?: string;
    thumbnailUrl?: string;
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

// === TRACK ===
export type TrackType = 'video' | 'audio';

export interface Track {
    id: string;
    type: TrackType;
    name: string;      // e.g. "V1", "V2", "A1"
    order: number;     // Display order (0 = top)
    locked: boolean;   // Locked tracks cannot be edited
    muted: boolean;    // For audio tracks
    visible: boolean;  // For video tracks
    height: number;    // Track height in pixels
}

// === SEGMENT ===
export type MediaKind = 'generated' | 'rush';

export interface Segment {
    id: string;
    projectId: string;
    trackId: string;   // Reference to parent track
    order: number;
    inSec: number;     // Timeline position start
    outSec: number;    // Timeline position end
    activeRevisionId?: string;
    label?: string;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
    // Media source (for rush imports)
    mediaKind?: MediaKind;
    mediaId?: string;       // ID for IndexedDB resolution
    mediaSrc?: string;      // URL to source media file
    sourceInSec?: number;   // In point within source media
    sourceOutSec?: number;  // Out point within source media
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
    tracks: Track[];
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    selectedTrackId: string | null;
    expandedSegmentIds: string[];
    generationQueue: { segmentId: string; revisionId: string }[];
    currentlyGenerating?: { segmentId: string; revisionId: string };
    playheadSec: number;
}

// === COMPONENT PROPS ===

export interface IterationThumbnailsProps {
    iterations: SegmentRevision[];
    activeRevisionId: string;
    previewingRevisionId?: string;
    onIterationClick: (revisionId: string) => void;
    onIterationDelete: (revisionId: string) => void;
}

export interface VerticalSegmentCardProps {
    segment: SegmentWithUI;
    isSelected: boolean;
    isExpanded: boolean;
    onClick: () => void;
    onExpand: () => void;
    onCollapse: () => void;
    onLock: () => void;
    onUnlock: () => void;
    onIterationClick: (revisionId: string) => void;
    onIterationValidate: (revisionId: string) => void;
    onIterationDelete: (revisionId: string) => void;
}

export interface VerticalTimelineStackProps {
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    expandedSegmentIds: string[];
    onSegmentClick: (segmentId: string) => void;
    onSegmentExpand: (segmentId: string) => void;
    onSegmentCollapse: (segmentId: string) => void;
    onIterationClick: (segmentId: string, revisionId: string) => void;
    onIterationValidate: (segmentId: string, revisionId: string) => void;
    onIterationDelete: (segmentId: string, revisionId: string) => void;
    onSegmentLock: (segmentId: string) => void;
    onSegmentUnlock: (segmentId: string) => void;
    onReprompt: (segmentId: string, newPrompt: string) => void;
}

export interface SegmentIAPanelProps {
    segment: SegmentWithUI | null;
    activeRevision: SegmentRevision | null;
    activeTab: 'prompt' | 'keyframes' | 'edit-image' | 'edit-video' | 'versions';
    onTabChange: (tab: SegmentIAPanelProps['activeTab']) => void;
    onReprompt: (newPrompt: string) => void;
    onRegenerate: () => void;
}
