/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PlaybackEngine - Frame-accurate continuous playback
 * 
 * OTIO-inspired: The timeline is the source of truth.
 * The engine advances a global clock, not individual media files.
 * 
 * Key concepts:
 * - globalTimeSec: Current position on the timeline (not in source media)
 * - fps: Frame rate for precise advancement
 * - Listeners receive time updates, they decide what to play
 */

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackEngineConfig {
    fps: 24 | 25 | 30;
    onTimeUpdate: (globalTimeSec: number) => void;
    onStateChange: (state: PlaybackState) => void;
    onEndReached: () => void;
}

export class PlaybackEngine {
    private globalTimeSec = 0;
    private state: PlaybackState = 'stopped';
    private lastFrameTime = 0;
    private animationFrameId: number | null = null;

    // Config
    private fps: number;
    private frameIntervalMs: number;
    private onTimeUpdate: (time: number) => void;
    private onStateChange: (state: PlaybackState) => void;
    private onEndReached: () => void;

    // Bounds
    private startBoundSec = 0;
    private endBoundSec = Infinity;

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
        this.globalTimeSec = this.startBoundSec;
        this.onStateChange('stopped');
        this.onTimeUpdate(this.globalTimeSec);
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
     * Seek to a specific time
     */
    seek(timeSec: number): void {
        const clampedTime = Math.max(this.startBoundSec, Math.min(this.endBoundSec, timeSec));
        this.globalTimeSec = clampedTime;
        this.onTimeUpdate(this.globalTimeSec);
    }

    /**
     * Set playback bounds (in/out points)
     */
    setBounds(startSec: number, endSec: number): void {
        this.startBoundSec = startSec;
        this.endBoundSec = endSec;

        // Clamp current time to new bounds
        if (this.globalTimeSec < startSec) {
            this.seek(startSec);
        } else if (this.globalTimeSec > endSec) {
            this.seek(endSec);
        }
    }

    /**
     * Get current time
     */
    getCurrentTime(): number {
        return this.globalTimeSec;
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
            const timeToAdd = framesToAdd / this.fps;

            this.globalTimeSec += timeToAdd;
            this.lastFrameTime = now - (elapsed % this.frameIntervalMs);

            // Check end reached
            if (this.globalTimeSec >= this.endBoundSec) {
                this.globalTimeSec = this.endBoundSec;
                this.onTimeUpdate(this.globalTimeSec);
                this.pause();
                this.onEndReached();
                return;
            }

            this.onTimeUpdate(this.globalTimeSec);
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
    };
}
