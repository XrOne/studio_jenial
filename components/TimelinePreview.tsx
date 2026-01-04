/**
 * TimelinePreview Component
 * Frame-accurate double-buffer playback system.
 * Uses two static video elements (A/B) to eliminate black flashes between segments.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { SegmentWithUI, Track } from '../types/timeline';
import { getMediaUrl } from '../utils/mediaResolver';
import { getMediaController } from '../services/mediaController';

interface TimelinePreviewProps {
    tracks: Track[];
    segments: SegmentWithUI[];
    playheadSec: number;
    isPlaying: boolean;
    onPlayPause: () => void;
    onSeek: (sec: number) => void;
    fps: number;
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
    tracks,
    segments,
    playheadSec,
    isPlaying,
    onPlayPause,
    onSeek,
    fps
}) => {
    // === DOUBLE BUFFER STATE ===
    const videoRefA = useRef<HTMLVideoElement>(null);
    const videoRefB = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Which player is currently visible?
    const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');

    // Track what is loaded in each player
    const playerContent = useRef<{
        A: { segmentId: string | null };
        B: { segmentId: string | null };
    }>({ A: { segmentId: null }, B: { segmentId: null } });

    // Resolved URLs cache
    const resolvedUrls = useRef<Map<string, string>>(new Map());
    const [forceUpdate, setForceUpdate] = useState(0); // Trigger re-render when URLs resolve

    // === MEDIA RESOLUTION ===
    useEffect(() => {
        const resolveMedia = async () => {
            let changed = false;
            for (const seg of segments) {
                if (seg.mediaId && !resolvedUrls.current.has(seg.mediaId)) {
                    const url = await getMediaUrl(seg.mediaId);
                    if (url) {
                        resolvedUrls.current.set(seg.mediaId, url);
                        changed = true;
                    }
                }
            }
            if (changed) setForceUpdate(n => n + 1);
        };
        resolveMedia();
    }, [segments]);

    // === PLAYBACK LOGIC ===

    // Find the current segment on V1 (Main Track)
    // EPSILON FRAME: Add tolerance to prevent "0 segment" at exact cut boundary
    // A segment is active if: playheadSec >= inSec && playheadSec < outSec + epsilon
    const currentV1Segment = useMemo(() => {
        const epsilon = 1.0 / fps; // 1 frame tolerance
        return segments.find(s =>
            s.trackId === 'v1' &&
            playheadSec >= s.inSec &&
            playheadSec < s.outSec + epsilon
        );
    }, [segments, playheadSec, fps]);

    // Find the NEXT segment on V1 (for preloading)
    const nextV1Segment = useMemo(() => {
        if (!currentV1Segment) return null;
        // Find segment starting explicitly at current.outSec (contiguous)
        // or very close to it.
        return segments.find(s =>
            s.trackId === 'v1' &&
            Math.abs(s.inSec - currentV1Segment.outSec) < 0.05
        );
    }, [segments, currentV1Segment]);

    // Helper: Load segment into player
    const loadSegmentIntoPlayer = useCallback((player: 'A' | 'B', segment: SegmentWithUI) => {
        const video = player === 'A' ? videoRefA.current : videoRefB.current;
        if (!video) return;

        const url = segment.mediaSrc ||
            (segment.mediaId ? resolvedUrls.current.get(segment.mediaId) : null) ||
            segment.activeRevision?.videoUrl;

        if (!url) return;

        // Verify if already loaded
        if (playerContent.current[player].segmentId === segment.id && video.src) {
            return; // Already loaded
        }

        console.log(`[TimelinePreview] Loading ${segment.label} into Player ${player}`);

        // Add event listeners for debugging
        const logEvent = (event: string) => () =>
            console.log(`[TimelinePreview][${player}] ${event} - readyState: ${video.readyState}`);

        video.addEventListener('waiting', logEvent('WAITING'), { once: true });
        video.addEventListener('stalled', logEvent('STALLED'), { once: true });
        video.addEventListener('seeking', logEvent('SEEKING'), { once: true });
        video.addEventListener('seeked', logEvent('SEEKED'), { once: true });
        video.addEventListener('canplay', logEvent('CANPLAY'), { once: true });

        video.src = url;
        video.load();
        playerContent.current[player].segmentId = segment.id;

        // Initial seek - to sourceInSec (start of source clip)
        video.currentTime = segment.sourceInSec ?? 0;
    }, []);

    // 1. SYNC ACTIVE PLAYER
    useEffect(() => {
        if (!currentV1Segment) return;

        const activeVideo = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
        if (!activeVideo) return;

        // Ensure active player has current segment
        if (playerContent.current[activePlayer].segmentId !== currentV1Segment.id) {
            console.log(`[TimelinePreview] Hard switch: Active ${activePlayer} needs ${currentV1Segment.label}`);
            loadSegmentIntoPlayer(activePlayer, currentV1Segment);
            // If hard switch while playing, we might need to play instantly
            if (isPlaying) {
                // If we hard-switched, we need to seek to current playhead
                const positionInSegment = playheadSec - currentV1Segment.inSec;
                activeVideo.currentTime = (currentV1Segment.sourceInSec ?? 0) + positionInSegment;
                activeVideo.play().catch(() => { });
            }
        }

        // Sync Time (Crucial for scrubbing)
        if (!isPlaying) {
            const positionInSegment = playheadSec - currentV1Segment.inSec;
            const seekPos = (currentV1Segment.sourceInSec ?? 0) + positionInSegment;

            if (Math.abs(activeVideo.currentTime - seekPos) > 0.04) {
                activeVideo.currentTime = seekPos;
            }
        }
    }, [currentV1Segment, activePlayer, isPlaying, playheadSec, loadSegmentIntoPlayer]);

    // 2. PRELOAD INACTIVE PLAYER
    useEffect(() => {
        if (!nextV1Segment) return;

        const inactivePlayer = activePlayer === 'A' ? 'B' : 'A';
        const inactiveVideo = activePlayer === 'A' ? videoRefB.current : videoRefA.current;

        if (!inactiveVideo) return;

        // Preload next segment
        if (playerContent.current[inactivePlayer].segmentId !== nextV1Segment.id) {
            loadSegmentIntoPlayer(inactivePlayer, nextV1Segment);
        }
    }, [nextV1Segment, activePlayer, loadSegmentIntoPlayer]);

    // 3. SEAMLESS TRANSITION (The "Magic")
    useEffect(() => {
        if (!isPlaying || !currentV1Segment || !nextV1Segment) return;

        // Check distance to cut
        const distToCut = currentV1Segment.outSec - playheadSec;

        // If we are VERY close to cut (e.g. 1-2 frames), verify Next Player is ready
        if (distToCut < (2 / fps) && distToCut > 0) {
            const inactivePlayer = activePlayer === 'A' ? 'B' : 'A';
            const inactiveVideo = activePlayer === 'A' ? videoRefB.current : videoRefA.current;

            if (inactiveVideo && playerContent.current[inactivePlayer].segmentId === nextV1Segment.id) {
                // Ensure it's ready
                if (inactiveVideo.readyState >= 2) {
                    // It's ready.
                    // We don't trigger swap here. We let the natural playback continue.
                    // BUT we can prime it.
                    // inactiveVideo.play(); // Maybe?
                    // No, wait for the exact moment.
                }
            }
        }
    }, [isPlaying, playheadSec, currentV1Segment, nextV1Segment, activePlayer, fps]);

    // 4. PRECISE SWAP - Simplified and robust approach
    // Key principles:
    // - Pre-play earlier (don't wait for readyState)
    // - Re-seek just before swap to ensure correct frame
    // - Swap only when video is actually playing (not paused)
    // - If not ready at cut, HOLD current frame (never show black)
    useEffect(() => {
        if (!isPlaying || !currentV1Segment || !nextV1Segment) return;

        const inactivePlayer = activePlayer === 'A' ? 'B' : 'A';
        const inactiveVideo = activePlayer === 'A' ? videoRefB.current : videoRefA.current;
        const activeVideo = activePlayer === 'A' ? videoRefA.current : videoRefB.current;

        if (!inactiveVideo || !activeVideo) return;
        if (playerContent.current[inactivePlayer].segmentId !== nextV1Segment.id) return;

        // Distance to cut in seconds
        const distToCut = currentV1Segment.outSec - playheadSec;

        // PHASE 1: 2s before cut - Start playing inactive video (hidden)
        // More aggressive: start even if readyState is low, the browser will buffer
        if (distToCut < 2.0 && distToCut > 0.5) {
            if (inactiveVideo.paused) {
                console.log(`[TimelinePreview] PRE-PLAY: Starting ${nextV1Segment.label} (readyState: ${inactiveVideo.readyState})`);
                inactiveVideo.currentTime = nextV1Segment.sourceInSec ?? 0;
                inactiveVideo.play().catch(() => { });
            }
        }

        // PHASE 2: 0.2s before cut - Re-seek to exact position (safety measure)
        if (distToCut < 0.2 && distToCut > 0.1 && !inactiveVideo.paused) {
            const targetTime = nextV1Segment.sourceInSec ?? 0;
            if (Math.abs(inactiveVideo.currentTime - targetTime) > 0.1) {
                console.log(`[TimelinePreview] RE-SEEK: Correcting position for ${nextV1Segment.label}`);
                inactiveVideo.currentTime = targetTime;
            }
        }

        // PHASE 3: At cut point - Swap if ready
        if (distToCut <= (2 / fps) && distToCut > -(2 / fps)) {
            // Capture refs to avoid closure issues
            const nextVideo: HTMLVideoElement = inactiveVideo;
            const prevVideo: HTMLVideoElement = activeVideo;
            const nextPlayer = inactivePlayer;

            // Check if next video is playing AND has enough data
            const isNextReady = !nextVideo.paused && nextVideo.readyState >= 3;

            if (isNextReady && nextVideo.style.opacity === '0') {
                // Use requestVideoFrameCallback for precise timing if available
                if ('requestVideoFrameCallback' in nextVideo) {
                    (nextVideo as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void })
                        .requestVideoFrameCallback(() => {
                            const gapFrames = Math.round((nextV1Segment.inSec - currentV1Segment.outSec) * fps);
                            console.log(`[TimelinePreview] FRAME-READY SWAP | Gap: ${gapFrames} frames`);

                            nextVideo.style.opacity = '1';
                            nextVideo.style.zIndex = '10';
                            prevVideo.style.opacity = '0';
                            prevVideo.style.zIndex = '0';
                            prevVideo.pause();

                            setActivePlayer(nextPlayer);
                        });
                } else {
                    // Fallback: swap immediately
                    const gapFrames = Math.round((nextV1Segment.inSec - currentV1Segment.outSec) * fps);
                    console.log(`[TimelinePreview] IMMEDIATE SWAP | Gap: ${gapFrames} frames`);

                    nextVideo.style.opacity = '1';
                    nextVideo.style.zIndex = '10';
                    prevVideo.style.opacity = '0';
                    prevVideo.style.zIndex = '0';
                    prevVideo.pause();

                    setActivePlayer(nextPlayer);
                }
            } else if (!isNextReady && distToCut <= 0) {
                // HOLD: Next not ready, keep current visible
                // Only log once per second to avoid spam
                if (Math.floor(playheadSec * 2) % 2 === 0) {
                    console.log(`[TimelinePreview] HOLD: Waiting for next video (readyState: ${nextVideo.readyState}, paused: ${nextVideo.paused})`);
                }
            }
        }
    }, [isPlaying, playheadSec, currentV1Segment, nextV1Segment, activePlayer, fps]);


    // HANDLE PLAY/PAUSE SYNC
    useEffect(() => {
        const video = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(e => console.error("Play failed", e));
        } else {
            video.pause();
        }
    }, [isPlaying, activePlayer]);


    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {/* VIDEO A */}
            <video
                ref={videoRefA}
                className={`absolute top-0 left-0 w-full h-full object-contain transition-none`}
                style={{
                    opacity: activePlayer === 'A' ? 1 : 0,
                    zIndex: activePlayer === 'A' ? 10 : 0
                }}
                muted
                playsInline
            />

            {/* VIDEO B */}
            <video
                ref={videoRefB}
                className={`absolute top-0 left-0 w-full h-full object-contain transition-none`}
                style={{
                    opacity: activePlayer === 'B' ? 1 : 0,
                    zIndex: activePlayer === 'B' ? 10 : 0
                }}
                muted
                playsInline
            />

            {/* OVERLAY INFO (DEBUG) */}
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs p-1 font-mono pointer-events-none z-50">
                P: {activePlayer} | Seg: {currentV1Segment?.label || 'None'} | {formatTimecode(playheadSec, fps)}
            </div>
        </div>
    );
};

// Helper
const formatTimecode = (seconds: number, fps: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};
