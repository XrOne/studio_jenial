/**
 * Project Types for Local Storage System
 * Premiere Pro-style project management
 */

// Project metadata (stored in localStorage)
export interface Project {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    fps: number;
    aspectRatio: string;
    resolution: string;

    // References to media in IndexedDB
    shotIds: string[];
    trackIds: string[];

    // Timeline state
    playheadSec: number;
    sequenceMode: 'plan-sequence' | 'decoupage';
}

// Single shot/plan (stored in IndexedDB)
export interface LocalShot {
    id: string;
    projectId: string;

    // Metadata
    prompt: string;
    createdAt: string;
    model?: string;
    segmentIndex?: number;

    // Media blobs (full quality)
    videoBlob?: Blob;
    thumbnailBlob?: Blob;

    // Proxy for web preview (720p)
    proxyVideoBlob?: Blob;

    // Fallback URLs if blob not available
    videoUrl?: string;
    thumbnailUrl?: string;
}

// Media asset (imported videos/images)
export interface LocalMediaAsset {
    id: string;
    projectId: string;

    // File info
    filename: string;
    mimeType: string;
    size: number;
    createdAt: string;

    // Full quality blob
    blob: Blob;

    // Proxy for preview
    proxyBlob?: Blob;

    // Dimensions
    width?: number;
    height?: number;
    duration?: number;
}

// Project file export format (.jenial)
export interface JenialProjectFile {
    version: '1.0';
    project: Project;

    // Embedded base64 for portability (optional)
    shots?: Array<{
        id: string;
        prompt: string;
        thumbnail?: string; // base64
        // Video NOT embedded (too large) - references only
        videoRef?: string; // relative path hint
    }>;

    // Timeline segments
    segments?: Array<{
        id: string;
        trackId: string;
        inSec: number;
        outSec: number;
        sourceInSec?: number;
        label?: string;
        shotId?: string; // Reference to shot
    }>;
}
