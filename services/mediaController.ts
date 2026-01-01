/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MediaController - Video/Audio pool management
 * 
 * Manages a pool of video and audio elements for seamless playback.
 * Handles preloading of upcoming segments for gapless transitions.
 * 
 * Key concepts:
 * - Pool of reusable video/audio elements
 * - Preload N+1 segment while playing N
 * - Seamless transitions via element swapping
 */

import { SegmentWithUI } from '../types/timeline';

export interface ActiveMedia {
    segmentId: string;
    element: HTMLVideoElement | HTMLAudioElement;
    sourceTimeSec: number;
    isActive: boolean;
}

export interface MediaControllerConfig {
    poolSize: number;
    onError?: (segmentId: string, error: Error) => void;
}

export class MediaController {
    private videoPool: Map<string, HTMLVideoElement> = new Map();
    private audioPool: Map<string, HTMLAudioElement> = new Map();
    private preloadedSegments: Set<string> = new Set();
    private activeVideoId: string | null = null;
    private activeAudioId: string | null = null;

    private config: MediaControllerConfig;

    constructor(config: MediaControllerConfig = { poolSize: 4 }) {
        this.config = config;
    }

    // === VIDEO MANAGEMENT ===

    /**
     * Get or create a video element for a segment
     */
    getVideo(segmentId: string): HTMLVideoElement {
        let video = this.videoPool.get(segmentId);
        if (!video) {
            video = document.createElement('video');
            video.muted = true; // Muted for autoplay (audio handled separately)
            video.playsInline = true;
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            this.videoPool.set(segmentId, video);
        }
        return video;
    }

    /**
     * Preload a segment's video
     */
    preloadVideo(segment: SegmentWithUI, sourceUrl: string): void {
        if (this.preloadedSegments.has(segment.id)) return;

        const video = this.getVideo(segment.id);

        if (video.src !== sourceUrl) {
            video.src = sourceUrl;

            // Seek to source in point
            video.onloadedmetadata = () => {
                const sourceIn = segment.sourceInSec ?? 0;
                if (video.currentTime !== sourceIn) {
                    video.currentTime = sourceIn;
                }
            };

            video.load();
        }

        this.preloadedSegments.add(segment.id);
        console.log(`[MediaController] Preloaded video: ${segment.id}`);
    }

    /**
     * Activate a video (start playing at correct position)
     */
    activateVideo(segmentId: string, sourceTimeSec: number): HTMLVideoElement | null {
        const video = this.videoPool.get(segmentId);
        if (!video) return null;

        // Seek if needed (with tolerance to avoid micro-seeks)
        if (Math.abs(video.currentTime - sourceTimeSec) > 0.05) {
            video.currentTime = sourceTimeSec;
        }

        this.activeVideoId = segmentId;
        return video;
    }

    /**
     * Play the active video
     */
    playActiveVideo(): void {
        if (this.activeVideoId) {
            const video = this.videoPool.get(this.activeVideoId);
            video?.play().catch(e => {
                console.warn('[MediaController] Video play failed:', e);
            });
        }
    }

    /**
     * Pause all videos
     */
    pauseAllVideos(): void {
        for (const video of this.videoPool.values()) {
            video.pause();
        }
    }

    /**
     * Get the active video element
     */
    getActiveVideo(): HTMLVideoElement | null {
        if (this.activeVideoId) {
            return this.videoPool.get(this.activeVideoId) || null;
        }
        return null;
    }

    // === AUDIO MANAGEMENT ===

    /**
     * Get or create an audio element for a segment
     */
    getAudio(segmentId: string): HTMLAudioElement {
        let audio = this.audioPool.get(segmentId);
        if (!audio) {
            audio = document.createElement('audio');
            audio.preload = 'auto';
            audio.crossOrigin = 'anonymous';
            this.audioPool.set(segmentId, audio);
        }
        return audio;
    }

    /**
     * Preload a segment's audio
     */
    preloadAudio(segment: SegmentWithUI, sourceUrl: string): void {
        const audio = this.getAudio(segment.id);

        if (audio.src !== sourceUrl) {
            audio.src = sourceUrl;

            audio.onloadedmetadata = () => {
                const sourceIn = segment.sourceInSec ?? 0;
                if (audio.currentTime !== sourceIn) {
                    audio.currentTime = sourceIn;
                }
            };

            audio.load();
        }
    }

    /**
     * Activate audio
     */
    activateAudio(segmentId: string, sourceTimeSec: number): HTMLAudioElement | null {
        const audio = this.audioPool.get(segmentId);
        if (!audio) return null;

        if (Math.abs(audio.currentTime - sourceTimeSec) > 0.05) {
            audio.currentTime = sourceTimeSec;
        }

        this.activeAudioId = segmentId;
        return audio;
    }

    /**
     * Play active audio
     */
    playActiveAudio(): void {
        if (this.activeAudioId) {
            const audio = this.audioPool.get(this.activeAudioId);
            audio?.play().catch(e => {
                console.warn('[MediaController] Audio play failed:', e);
            });
        }
    }

    /**
     * Pause all audio
     */
    pauseAllAudio(): void {
        for (const audio of this.audioPool.values()) {
            audio.pause();
        }
    }

    /**
     * Clear audio (for muted tracks)
     */
    clearActiveAudio(): void {
        this.activeAudioId = null;
        this.pauseAllAudio();
    }

    // === CLEANUP ===

    /**
     * Remove a segment's media from pools
     */
    removeSegment(segmentId: string): void {
        const video = this.videoPool.get(segmentId);
        if (video) {
            video.pause();
            video.src = '';
            video.load();
            this.videoPool.delete(segmentId);
        }

        const audio = this.audioPool.get(segmentId);
        if (audio) {
            audio.pause();
            audio.src = '';
            audio.load();
            this.audioPool.delete(segmentId);
        }

        this.preloadedSegments.delete(segmentId);
    }

    /**
     * Clear all pools
     */
    dispose(): void {
        for (const video of this.videoPool.values()) {
            video.pause();
            video.src = '';
        }
        this.videoPool.clear();

        for (const audio of this.audioPool.values()) {
            audio.pause();
            audio.src = '';
        }
        this.audioPool.clear();

        this.preloadedSegments.clear();
    }

    // === POOL STATS ===

    getPoolStats(): { videos: number; audios: number; preloaded: number } {
        return {
            videos: this.videoPool.size,
            audios: this.audioPool.size,
            preloaded: this.preloadedSegments.size
        };
    }
}

// === SINGLETON INSTANCE ===
let mediaControllerInstance: MediaController | null = null;

export function getMediaController(): MediaController {
    if (!mediaControllerInstance) {
        mediaControllerInstance = new MediaController({ poolSize: 4 });
    }
    return mediaControllerInstance;
}
