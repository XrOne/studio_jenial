/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PlaybackEngine - Frame-accurate continuous playback
 * 
 * OTIO-inspired: The timeline is the source of truth.
 * The engine advances a global clock in integer frames, not seconds.
 * This prevents floating point drift over long durations.
 * 
 * Key concepts:
 * - globalFrame: Current position on the timeline (frames)
 * - fps: Frame rate for precise advancement
 * - Listeners receive time updates (in seconds for UI), they decide what to play
 */

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackEngineConfig {
    fps: 24 | 25 | 30;
    onTimeUpdate: (globalTimeSec: number) => void;
    onStateChange: (state: PlaybackState) => void;
    onEndReached: () => void;
}

export class PlaybackEngine {
    private globalFrame = 0;
    private state: PlaybackState = 'stopped';
    private lastFrameTime = 0;
    private animationFrameId: number | null = null;

    // Config
    private fps: number;
    private frameIntervalMs: number;
    private onTimeUpdate: (time: number) => void;
    private onStateChange: (state: PlaybackState) => void;
    private onEndReached: () => void;

    // Bounds (Frames)
    private startFrameBound = 0;
    private endFrameBound = Infinity;

    constructor(config: PlaybackEngineConfig) {
        this.fps = config.fps;
        this.frameIntervalMs = 1000 / config.fps;
        this.onTimeUpdate = config.onTimeUpdate;
        this.onStateChange = config.onStateChange;
        this.onEndReached = config.onEndReached;
    }

    // === PUBLIC API ===

    /**
     * Start or resume playback
     */
    play(): void {
        if (this.state === 'playing') return;

        this.state = 'playing';
        this.lastFrameTime = performance.now();
        this.onStateChange('playing');
        this.tick();
    }

    /**
     * Pause playback
     */
    pause(): void {
        if (this.state !== 'playing') return;

        this.state = 'paused';
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.onStateChange('paused');
    }

    /**
     * Stop and reset to start
     */
    stop(): void {
        this.state = 'stopped';
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.globalFrame = this.startFrameBound;
        this.onStateChange('stopped');
        this.notifyTimeUpdate();
    }

    /**
     * Toggle play/pause
     */
    togglePlayPause(): void {
        if (this.state === 'playing') {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * Seek to a specific time (seconds)
     * Converted to nearest frame internally
     */
    seek(timeSec: number): void {
        const frame = Math.round(timeSec * this.fps);
        const clampedFrame = Math.max(this.startFrameBound, Math.min(this.endFrameBound, frame));
        this.globalFrame = clampedFrame;
        this.notifyTimeUpdate();
    }

    /**
     * Set playback bounds (in/out points in seconds)
     */
    setBounds(startSec: number, endSec: number): void {
        this.startFrameBound = Math.round(startSec * this.fps);
        this.endFrameBound = Math.round(endSec * this.fps);

        // Clamp current time to new bounds
        if (this.globalFrame < this.startFrameBound) {
            this.globalFrame = this.startFrameBound;
            this.notifyTimeUpdate();
        } else if (this.globalFrame > this.endFrameBound) {
            this.globalFrame = this.endFrameBound;
            this.notifyTimeUpdate();
        }
    }

    /**
     * Get current time in seconds
     */
    getCurrentTime(): number {
        return this.globalFrame / this.fps;
    }

    /**
     * Get current frame
     */
    getCurrentFrame(): number {
        return this.globalFrame;
    }

    /**
     * Get current state
     */
    getState(): PlaybackState {
        return this.state;
    }

    /**
     * Update FPS (e.g., when project settings change)
     */
    setFps(fps: 24 | 25 | 30): void {
        this.fps = fps;
        this.frameIntervalMs = 1000 / fps;
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.stop();
    }

    // === PRIVATE ===

    private notifyTimeUpdate(): void {
        this.onTimeUpdate(this.globalFrame / this.fps);
    }

    /**
     * Main animation loop - advances time by whole frames
     */
    private tick = (): void => {
        if (this.state !== 'playing') return;

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;

        // Only advance by whole frames for accuracy
        if (elapsed >= this.frameIntervalMs) {
            const framesToAdd = Math.floor(elapsed / this.frameIntervalMs);

            this.globalFrame += framesToAdd;
            this.lastFrameTime = now - (elapsed % this.frameIntervalMs);

            // Check end reached
            if (this.globalFrame >= this.endFrameBound) {
                this.globalFrame = this.endFrameBound;
                this.notifyTimeUpdate();
                this.pause();
                this.onEndReached();
                return;
            }

            this.notifyTimeUpdate();
        }

        // Continue loop
        this.animationFrameId = requestAnimationFrame(this.tick);
    };
}

// === HOOK FOR REACT ===

import { useRef, useEffect, useCallback, useState } from 'react';

export interface UsePlaybackEngineOptions {
    fps: 24 | 25 | 30;
    totalDuration: number;
    onTimeUpdate?: (time: number) => void;
}

export function usePlaybackEngine(options: UsePlaybackEngineOptions) {
    const { fps, totalDuration, onTimeUpdate } = options;
    const engineRef = useRef<PlaybackEngine | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    // Create engine on mount
    useEffect(() => {
        const engine = new PlaybackEngine({
            fps,
            onTimeUpdate: (time) => {
                setCurrentTime(time);
                onTimeUpdate?.(time);
            },
            onStateChange: (state) => {
                setIsPlaying(state === 'playing');
            },
            onEndReached: () => {
                console.log('[PlaybackEngine] End of timeline reached');
            }
        });

        engine.setBounds(0, totalDuration);
        engineRef.current = engine;

        return () => {
            engine.dispose();
        };
    }, [fps]); // Only recreate if fps changes

    // Update bounds when duration changes
    useEffect(() => {
        engineRef.current?.setBounds(0, totalDuration);
    }, [totalDuration]);

    // External seek handler
    const seek = useCallback((time: number) => {
        engineRef.current?.seek(time);
    }, []);

    // Play/pause toggle
    const togglePlayPause = useCallback(() => {
        engineRef.current?.togglePlayPause();
    }, []);

    // Play
    const play = useCallback(() => {
        engineRef.current?.play();
    }, []);

    // Pause
    const pause = useCallback(() => {
        engineRef.current?.pause();
    }, []);

    // Stop
    const stop = useCallback(() => {
        engineRef.current?.stop();
    }, []);

    return {
        isPlaying,
        currentTime,
        seek,
        play,
        pause,
        stop,
        togglePlayPause,
        engine: engineRef.current // Expose engine for direct access
    };
}
