/**
 * Local Media Library Types
 * Types for the Bin Manager / Rush system
 */

export interface RushMedia {
    id: string;
    name: string;
    type: 'video' | 'image';
    /** Object URL for local playback (created via URL.createObjectURL) */
    localUrl: string;
    /** Base64 thumbnail for grid display */
    thumbnail?: string;
    /** Duration in seconds (for videos) */
    durationSec?: number;
    /** Original file size in bytes */
    sizeBytes: number;
    /** MIME type */
    mimeType: string;
    /** Upload timestamp */
    createdAt: number;
    /** Tags for organization */
    tags?: string[];
    /** Rich metadata extracted on import */
    metadata?: {
        width: number;
        height: number;
        fps: number;
        totalFrames: number;
        isVFR?: boolean;
    };
}

export interface MediaUploadResult {
    success: boolean;
    media?: RushMedia;
    error?: string;
}

export interface LocalMediaLibraryState {
    rushes: RushMedia[];
    generated: RushMedia[];
    isLoading: boolean;
}
