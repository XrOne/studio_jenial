/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vertical Timeline Types
 * Types for the vertical timeline editing feature
 */

import { Dogma, ImageFile, SequenceVideoData } from './types';

// === Segment States ===
export type VerticalSegmentState = 'unlocked' | 'expanded' | 'previewing' | 'locked';

// === Generation Status ===
export type IterationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

// === AI Model for generation ===
export type AIModelType = 'veo' | 'kling' | 'nano' | string;

// === Shot Types (valeurs de plan) ===
export type ShotType =
    | 'ensemble'      // Plan d'ensemble
    | 'demi-ensemble' // Demi-ensemble
    | 'moyen'         // Plan moyen
    | 'americain'     // Plan américain
    | 'rapproché'     // Plan rapproché
    | 'large'         // Plan large
    | 'détail'        // Plan détail
    | 'gros-plan'     // Gros plan
    | string;         // Custom

/**
 * A single iteration/version of a segment
 * Generated via re-prompt or initial creation
 */
export interface SegmentIteration {
    id: string;
    createdAt: string; // ISO date

    // Generation parameters
    prompt: string;
    model: AIModelType;
    status: IterationStatus;

    // Results (populated after generation succeeds)
    videoUrl?: string;
    keyframeThumbnail?: string; // base64
    duration?: number; // seconds

    // Shot metadata
    shotType?: ShotType;

    // Link to full video data if available
    videoData?: SequenceVideoData;
}

/**
 * A segment in the vertical timeline stack
 * Represents one "slot" in the horizontal timeline
 */
export interface VerticalTimelineSegment {
    id: string;

    // Position in horizontal timeline (0-indexed)
    position: number;

    // Currently active iteration (shown in horizontal TL)
    activeIterationId: string;

    // All iterations for this segment
    iterations: SegmentIteration[];

    // UI state
    state: VerticalSegmentState;
    previewingIterationId?: string; // Which iteration is being previewed

    // Inherited or segment-specific dogma
    dogma?: Dogma;
    dogmaId?: string;

    // Timing info (from horizontal timeline)
    startTime: number; // seconds
    duration: number;  // seconds

    // Display name
    label?: string; // e.g., "Plan 1 - Ensemble"
}

/**
 * State for the entire vertical timeline component
 */
export interface VerticalTimelineState {
    segments: VerticalTimelineSegment[];

    // Selection state
    selectedSegmentIds: string[];

    // Multi-expansion support
    expandedSegmentIds: string[];

    // Generation queue
    generationQueue: {
        segmentId: string;
        iterationId: string;
    }[];

    // Active generation
    currentlyGenerating?: {
        segmentId: string;
        iterationId: string;
    };
}

/**
 * Props for VerticalTimelineStack component
 */
export interface VerticalTimelineStackProps {
    segments: VerticalTimelineSegment[];
    selectedSegmentIds: string[];
    expandedSegmentIds: string[];

    // Callbacks
    onSegmentClick: (segmentId: string) => void;
    onSegmentExpand: (segmentId: string) => void;
    onSegmentCollapse: (segmentId: string) => void;
    onIterationClick: (segmentId: string, iterationId: string) => void;
    onIterationValidate: (segmentId: string, iterationId: string) => void;
    onIterationDelete: (segmentId: string, iterationId: string) => void;
    onSegmentLock: (segmentId: string) => void;
    onSegmentUnlock: (segmentId: string) => void;

    // Re-prompt
    onReprompt: (segmentId: string, newPrompt: string) => void;
}

/**
 * Props for individual segment card
 */
export interface VerticalSegmentCardProps {
    segment: VerticalTimelineSegment;
    isSelected: boolean;
    isExpanded: boolean;

    // Callbacks
    onClick: () => void;
    onExpand: () => void;
    onCollapse: () => void;
    onLock: () => void;
    onUnlock: () => void;
    onIterationClick: (iterationId: string) => void;
    onIterationValidate: (iterationId: string) => void;
    onIterationDelete: (iterationId: string) => void;
}

/**
 * Props for iteration thumbnails strip
 */
export interface IterationThumbnailsProps {
    iterations: SegmentIteration[];
    activeIterationId: string;
    previewingIterationId?: string;

    onIterationClick: (iterationId: string) => void;
    onIterationDelete: (iterationId: string) => void;
}

/**
 * Props for the IA Panel (right side)
 */
export interface SegmentIAPanelProps {
    segment: VerticalTimelineSegment | null;
    activeIteration: SegmentIteration | null;

    // Active tab
    activeTab: 'prompt' | 'keyframes' | 'edit-image' | 'edit-video' | 'versions';
    onTabChange: (tab: SegmentIAPanelProps['activeTab']) => void;

    // Callbacks
    onReprompt: (newPrompt: string) => void;
    onRegenerate: () => void;
}
