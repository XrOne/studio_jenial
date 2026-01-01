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
    // TODO: Support multi-track compositing. For now, optimize V1 cuts.
    const currentV1Segment = useMemo(() => {
        return segments.find(s =>
            s.trackId === 'v1' &&
            playheadSec >= s.inSec &&
            playheadSec < s.outSec
        );
    }, [segments, playheadSec]);

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
        video.src = url;
        video.load();
        playerContent.current[player].segmentId = segment.id;

        // Initial seek
        // Calculate seek position (frame accurate ideally)
        // For preload, we seek to sourceInSec
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

    // 4. PRECISE FRAME CALLBACK & SWAP loop
    // This loop runs every render frame (requestAnimationFrame) to check cuts precisely
    useEffect(() => {
        if (!isPlaying) return;

        const activeVideo = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
        if (!activeVideo) return;

        let animationHandle: number;

        const checkCut = () => {
            if (currentV1Segment && nextV1Segment) {
                // The CUT determines that we should be playing the NEXT segment
                // If playhead >= outSec of current, we should have swapped.
                // We add a tolerance (0.5 frames) to trigger swap slightly early?
                // No, trigger swap exactly at boundary.
                // Actually, "globalFrame" from Engine is the truth.

                // If playheadSec enters next segment's domain:
                if (playheadSec >= currentV1Segment.outSec - (1.0 / fps)) {
                    // Time to swap!
                    const inactivePlayer = activePlayer === 'A' ? 'B' : 'A';
                    const inactiveVideo = activePlayer === 'A' ? videoRefB.current : videoRefA.current;

                    if (inactiveVideo && playerContent.current[inactivePlayer].segmentId === nextV1Segment.id) {
                        // Only swap if we haven't already swapped (checked by activePlayer state in dependency)
                        // But playheadSec updates continuously.
                        // We rely on state activePlayer to not re-swap back?
                        // "currentV1Segment" will change AFTER playhead crosses boundary.
                        // So we have a small window where playhead is past outSec, but currentV1Segment hasn't updated in React?
                        // No, currentV1Segment is memoized on playheadSec.

                        // Issue: If currentV1Segment updates, then NEXT segment becomes CURRENT.
                        // So we'd be in the NEW segment.
                        // So we don't need to force swap??
                        // REACT will swap?
                        // NO. React state update is slow. Double buffer means we manually swap DOM VISIBILITY before React catches up.

                        // BUT `activePlayer` IS React state.
                        // So waiting for `activePlayer` to update relies on React render cycle (16ms).
                        // We want instant swap.

                        // FORCE DOM UPDATE
                        if (inactiveVideo.style.opacity === '0') {
                            const gapFrames = Math.round((nextV1Segment.inSec - currentV1Segment.outSec) * fps);
                            console.log(`[TimelinePreview] INSTANT SWAP at ${formatTimecode(playheadSec, fps)} | Gap: ${gapFrames} frames`);
                            inactiveVideo.style.opacity = '1';
                            inactiveVideo.style.zIndex = '10';
                            activeVideo.style.opacity = '0';
                            activeVideo.style.zIndex = '0';

                            inactiveVideo.play().catch(e => console.error(e));

                            // Update State to match DOM
                            setActivePlayer(inactivePlayer);
                        }
                    }
                }
            }
            animationHandle = requestAnimationFrame(checkCut);
        };

        checkCut();
        return () => cancelAnimationFrame(animationHandle);
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
