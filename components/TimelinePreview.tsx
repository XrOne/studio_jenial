/**
 * TimelinePreview Component
 * SIMPLIFIED double-buffer playback system.
 * Uses two static video elements (A/B) to eliminate black flashes between segments.
 * 
 * PRINCIPLE: Keep it simple. One swap logic, no pre-play conflicts.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { SegmentWithUI, Track } from '../types/timeline';
import { getMediaUrl } from '../utils/mediaResolver';

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

    // Which player is currently visible?
    const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');

    // Track what is loaded in each player
    const playerContent = useRef<{
        A: { segmentId: string | null };
        B: { segmentId: string | null };
    }>({ A: { segmentId: null }, B: { segmentId: null } });

    // Resolved URLs cache
    const resolvedUrls = useRef<Map<string, string>>(new Map());
    const [forceUpdate, setForceUpdate] = useState(0);

    // Swap already triggered for this segment?
    const swapTriggered = useRef<string | null>(null);

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

    // === SEGMENT DETECTION ===

    // Find the current segment on V1
    const currentV1Segment = useMemo(() => {
        const epsilon = 1.0 / fps;
        return segments.find(s =>
            s.trackId === 'v1' &&
            playheadSec >= s.inSec &&
            playheadSec < s.outSec + epsilon
        );
    }, [segments, playheadSec, fps]);

    // Find the NEXT segment on V1 (for preloading)
    const nextV1Segment = useMemo(() => {
        if (!currentV1Segment) return null;
        return segments.find(s =>
            s.trackId === 'v1' &&
            Math.abs(s.inSec - currentV1Segment.outSec) < 0.05
        );
    }, [segments, currentV1Segment]);

    // Helper: Get URL for segment
    const getSegmentUrl = useCallback((segment: SegmentWithUI): string | null => {
        return segment.mediaSrc ||
            (segment.mediaId ? resolvedUrls.current.get(segment.mediaId) : null) ||
            segment.activeRevision?.videoUrl ||
            null;
    }, []);

    // === SINGLE UNIFIED PLAYBACK EFFECT ===
    useEffect(() => {
        const videoA = videoRefA.current;
        const videoB = videoRefB.current;
        if (!videoA || !videoB) return;

        const activeVideo = activePlayer === 'A' ? videoA : videoB;
        const inactiveVideo = activePlayer === 'A' ? videoB : videoA;
        const inactivePlayerName: 'A' | 'B' = activePlayer === 'A' ? 'B' : 'A';

        // 0. END OF TIMELINE: No current segment = pause and show black
        if (!currentV1Segment) {
            activeVideo.pause();
            inactiveVideo.pause();
            return;
        }

        // 1. ENSURE CURRENT SEGMENT IS LOADED IN ACTIVE PLAYER
        const wantedId = currentV1Segment.id;
        const currentLoadedId = playerContent.current[activePlayer].segmentId;

        if (currentLoadedId !== wantedId) {
            const url = getSegmentUrl(currentV1Segment);
            if (url) {
                console.log(`[TimelinePreview] Loading ${currentV1Segment.label} into Active ${activePlayer}`);
                activeVideo.src = url;
                activeVideo.load();
                playerContent.current[activePlayer].segmentId = wantedId;

                const posInSeg = playheadSec - currentV1Segment.inSec;
                activeVideo.currentTime = (currentV1Segment.sourceInSec ?? 0) + posInSeg;

                if (isPlaying) {
                    activeVideo.play().catch(() => { });
                }
            }
        }

        // 2. SYNC TIME (for scrubbing when not playing)
        if (!isPlaying) {
            const posInSeg = playheadSec - currentV1Segment.inSec;
            const seekPos = (currentV1Segment.sourceInSec ?? 0) + posInSeg;
            if (Math.abs(activeVideo.currentTime - seekPos) > 0.05) {
                activeVideo.currentTime = seekPos;
            }
        }

        // 3. PRELOAD NEXT SEGMENT INTO INACTIVE PLAYER
        if (nextV1Segment) {
            const nextWantedId = nextV1Segment.id;
            const inactiveLoadedId = playerContent.current[inactivePlayerName].segmentId;

            if (inactiveLoadedId !== nextWantedId) {
                const url = getSegmentUrl(nextV1Segment);
                if (url) {
                    console.log(`[TimelinePreview] Preloading ${nextV1Segment.label} into Inactive ${inactivePlayerName}`);
                    inactiveVideo.src = url;
                    inactiveVideo.load();
                    playerContent.current[inactivePlayerName].segmentId = nextWantedId;
                    inactiveVideo.currentTime = nextV1Segment.sourceInSec ?? 0;
                }
            }
        }

        // 4. SWAP LOGIC - At cut point
        if (nextV1Segment && isPlaying) {
            const distToCut = currentV1Segment.outSec - playheadSec;

            if (distToCut <= (2 / fps) && distToCut > -(3 / fps)) {
                const nextLoadedId = playerContent.current[inactivePlayerName].segmentId;

                if (nextLoadedId === nextV1Segment.id && swapTriggered.current !== nextV1Segment.id) {
                    if (inactiveVideo.readyState >= 2) {
                        console.log(`[TimelinePreview] SWAP: ${activePlayer} → ${inactivePlayerName}`);
                        swapTriggered.current = nextV1Segment.id;

                        inactiveVideo.currentTime = nextV1Segment.sourceInSec ?? 0;
                        inactiveVideo.play().then(() => {
                            setActivePlayer(inactivePlayerName);
                            setTimeout(() => activeVideo.pause(), 50);
                        }).catch(() => {
                            setActivePlayer(inactivePlayerName);
                        });
                    }
                }
            }
        }
    }, [playheadSec, isPlaying, currentV1Segment, nextV1Segment, activePlayer, fps, getSegmentUrl]);

    // === PLAY/PAUSE SYNC ===
    useEffect(() => {
        const video = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying, activePlayer]);

    // Determine if we should show video or black
    const hasActiveSegment = currentV1Segment !== undefined;

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
            {/* VIDEO A */}
            <video
                ref={videoRefA}
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{
                    opacity: hasActiveSegment && activePlayer === 'A' ? 1 : 0,
                    zIndex: activePlayer === 'A' ? 10 : 0,
                    transition: 'none'
                }}
                muted
                playsInline
            />

            {/* VIDEO B */}
            <video
                ref={videoRefB}
                className="absolute top-0 left-0 w-full h-full object-contain"
                style={{
                    opacity: hasActiveSegment && activePlayer === 'B' ? 1 : 0,
                    zIndex: activePlayer === 'B' ? 10 : 0,
                    transition: 'none'
                }}
                muted
                playsInline
            />

            {/* DEBUG OVERLAY */}
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs p-1 font-mono pointer-events-none z-50">
                {activePlayer} | {currentV1Segment?.label?.slice(0, 20) || 'END'} | {formatTimecode(playheadSec, fps)}
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
