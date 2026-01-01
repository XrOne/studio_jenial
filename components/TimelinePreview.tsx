/**
 * TimelinePreview Component
 * Real-time video preview synchronized with timeline playhead
 * Supports multi-track video stacking with correct source seek
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

interface ActiveVideoLayer {
    segment: SegmentWithUI;
    zIndex: number;
    seekPosition: number;
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
    const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const audioRef = useRef<HTMLAudioElement>(null);
    const [activeVideoLayers, setActiveVideoLayers] = useState<ActiveVideoLayer[]>([]);
    const [activeAudioSegment, setActiveAudioSegment] = useState<SegmentWithUI | null>(null);
    const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

    // Resolve persistent media URLs
    useEffect(() => {
        const resolveMedia = async () => {
            const newUrls: Record<string, string> = {};
            for (const seg of segments) {
                if (seg.mediaId && !resolvedUrls[seg.mediaId]) {
                    const url = await getMediaUrl(seg.mediaId);
                    if (url) newUrls[seg.mediaId] = url;
                }
            }
            if (Object.keys(newUrls).length > 0) {
                setResolvedUrls(prev => ({ ...prev, ...newUrls }));
            }
        };
        resolveMedia();
    }, [segments]);

    // Format timecode (HH:MM:SS:FF)
    const formatTimecode = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const f = Math.floor((seconds % 1) * fps);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    };

    // Get video tracks sorted by order (highest priority first = lowest order)
    const videoTracks = useMemo(() =>
        tracks.filter(t => t.type === 'video' && t.visible).sort((a, b) => a.order - b.order),
        [tracks]
    );

    const audioTracks = useMemo(() =>
        tracks.filter(t => t.type === 'audio' && !t.muted),
        [tracks]
    );

    // Find active video segments at playhead for each video track
    useEffect(() => {
        const layers: ActiveVideoLayer[] = [];

        for (const track of videoTracks) {
            const segment = segments.find(s =>
                s.trackId === track.id &&
                playheadSec >= s.inSec &&
                playheadSec < s.outSec
            );

            if (segment) {
                // Calculate position within source media
                const positionInSegment = playheadSec - segment.inSec;
                const seekPosition = (segment.sourceInSec ?? 0) + positionInSegment;

                // Get video URL from mediaSrc or activeRevision
                const hasVideo = segment.mediaSrc || segment.activeRevision?.videoUrl;

                if (hasVideo) {
                    layers.push({
                        segment,
                        zIndex: videoTracks.length - track.order, // Top track has highest z-index
                        seekPosition
                    });
                }
            }
        }

        setActiveVideoLayers(layers);

        // Find active audio segment (only from non-muted audio tracks)
        let foundAudioSegment: SegmentWithUI | null = null;
        for (const track of audioTracks) {
            const audioSeg = segments.find(s =>
                s.trackId === track.id &&
                playheadSec >= s.inSec &&
                playheadSec < s.outSec
            );
            if (audioSeg) {
                foundAudioSegment = audioSeg;
                break;
            }
        }
        // Clear audio if no segment found (handles mute/delete)
        setActiveAudioSegment(foundAudioSegment);
    }, [segments, playheadSec, videoTracks, audioTracks]);

    // Sync video and audio positions with playhead
    useEffect(() => {
        if (isPlaying) return; // Don't seek while playing

        // Sync Video
        for (const layer of activeVideoLayers) {
            const video = videoRefs.current.get(layer.segment.id);
            if (video && Math.abs(video.currentTime - layer.seekPosition) > 0.05) {
                video.currentTime = layer.seekPosition;
            }
        }

        // Sync Audio
        if (activeAudioSegment && audioRef.current) {
            const positionInSegment = playheadSec - activeAudioSegment.inSec;
            const seekPosition = (activeAudioSegment.sourceInSec ?? 0) + positionInSegment;
            if (Math.abs(audioRef.current.currentTime - seekPosition) > 0.05) {
                audioRef.current.currentTime = seekPosition;
            }
        }
    }, [playheadSec, activeVideoLayers, activeAudioSegment, isPlaying]);

    // Handle play/pause for all videos AND audio
    useEffect(() => {
        // Videos
        for (const [, video] of videoRefs.current) {
            if (isPlaying) {
                video.play().catch(() => { });
            } else {
                video.pause();
            }
        }
        // Audio - only play if there's an active audio segment
        if (audioRef.current) {
            if (activeAudioSegment && isPlaying) {
                audioRef.current.play().catch(() => { });
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, activeAudioSegment, activeVideoLayers]); // Added activeVideoLayers to trigger play on new segments

    // Handle video time update during playback (from top layer)
    // NEW: Engine-driven approach - video syncs to global time, not the other way around
    const handleTimeUpdate = useCallback((segmentId: string) => {
        // When engine is driving playback, we don't need to update time from video
        // This handler is now only used for scrubbing (when not playing)
        if (isPlaying) return;

        const topLayer = activeVideoLayers[0];
        if (!topLayer || topLayer.segment.id !== segmentId) return;

        const video = videoRefs.current.get(segmentId);
        if (!video) return;

        const segment = topLayer.segment;
        const sourceInSec = segment.sourceInSec ?? 0;

        // Calculate current timeline position from video position
        const sourceOffset = video.currentTime - sourceInSec;
        const currentTimelinePos = segment.inSec + sourceOffset;
        const clampedPos = Math.min(segment.outSec, Math.max(segment.inSec, currentTimelinePos));

        onSeek(clampedPos);
    }, [isPlaying, activeVideoLayers, onSeek]);

    // NEW: Continuous playback tick - check if we need to transition
    useEffect(() => {
        if (!isPlaying) return;

        const topLayer = activeVideoLayers[0];
        if (!topLayer) return;

        const segment = topLayer.segment;

        // Check if playhead has passed current segment's end
        if (playheadSec >= segment.outSec - 0.02) {
            // Find next segment on V1 track
            const v1Segments = segments.filter(s => s.trackId === 'v1').sort((a, b) => a.inSec - b.inSec);
            const nextSegment = v1Segments.find(s => s.inSec >= segment.outSec - 0.01);

            if (nextSegment) {
                console.log(`[TimelinePreview] Seamless transition: ${segment.label} -> ${nextSegment.label}`);
                // NO pause, NO seek - let the layer update handle the transition
                // The activeVideoLayers effect will pick up the new segment
            } else if (playheadSec >= segment.outSec) {
                // End of timeline
                console.log(`[TimelinePreview] End of timeline at ${segment.outSec}s`);
                onPlayPause();
            }
        }
    }, [isPlaying, playheadSec, activeVideoLayers, segments, onPlayPause]);

    // Preload next segment when approaching end of current (Phase 5)
    useEffect(() => {
        if (!isPlaying) return;

        const topLayer = activeVideoLayers[0];
        if (!topLayer) return;

        const segment = topLayer.segment;
        const timeToEnd = segment.outSec - playheadSec;

        // Start preloading when 1 second from end
        if (timeToEnd > 0 && timeToEnd <= 1.0) {
            const v1Segments = segments.filter(s => s.trackId === 'v1').sort((a, b) => a.inSec - b.inSec);
            const nextSegment = v1Segments.find(s => s.inSec >= segment.outSec - 0.01);

            if (nextSegment) {
                const url = nextSegment.mediaSrc || nextSegment.activeRevision?.videoUrl;
                if (url) {
                    const controller = getMediaController();
                    controller.preloadVideo(nextSegment, url);
                }
            }
        }
    }, [isPlaying, playheadSec, activeVideoLayers, segments]);

    // Handle video ended (backup for non-trimmed clips)
    const handleEnded = useCallback(() => {
        const topLayer = activeVideoLayers[0];
        if (!topLayer) {
            onPlayPause();
            return;
        }

        // Find next segment on same track
        const v1Segments = segments.filter(s => s.trackId === 'v1').sort((a, b) => a.inSec - b.inSec);
        const nextSegment = v1Segments.find(s => s.inSec >= topLayer.segment.outSec);

        if (nextSegment) {
            console.log(`[TimelinePreview] onEnded transition to ${nextSegment.id}`);
            onSeek(nextSegment.inSec);
        } else {
            onPlayPause(); // Stop at end
        }
    }, [activeVideoLayers, segments, onSeek, onPlayPause]);

    const getVideoUrl = (segment: SegmentWithUI): string | null => {
        if (segment.mediaId && resolvedUrls[segment.mediaId]) {
            return resolvedUrls[segment.mediaId];
        }
        return segment.mediaSrc || segment.activeRevision?.videoUrl || segment.activeRevision?.outputAsset?.url || null;
    };

    const topLayer = activeVideoLayers[0];
    const totalDuration = useMemo(() => {
        if (segments.length === 0) return 30;
        return Math.max(...segments.map(s => s.outSec));
    }, [segments]);

    return (
        <div className="flex-1 bg-black flex flex-col min-w-0 relative border-r border-[#3f3f46]">
            {/* Header */}
            <div className="h-10 bg-[#1e1e1e] border-b border-[#3f3f46] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">
                        {topLayer?.segment.label || 'Program Monitor'}
                    </span>
                    <div className="h-3 w-px bg-gray-700"></div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-600 rounded text-white font-mono">PROGRAM</span>
                    {activeVideoLayers.length > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 rounded text-white font-mono">
                            {activeVideoLayers.length} LAYERS
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{segments.length} segments</span>
                </div>
            </div>

            {/* Video Display - Stacked layers */}
            <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a]">
                {activeVideoLayers.length > 0 ? (
                    <div className="aspect-video w-full h-full max-h-[90%] max-w-[95%] relative shadow-2xl bg-black overflow-hidden">
                        {/* Render all video layers */}
                        {activeVideoLayers.map((layer, index) => {
                            const url = getVideoUrl(layer.segment);
                            if (!url) return null;

                            return (
                                <video
                                    key={layer.segment.id}
                                    ref={el => {
                                        if (el) videoRefs.current.set(layer.segment.id, el);
                                        else videoRefs.current.delete(layer.segment.id);
                                    }}
                                    src={url}
                                    className="absolute inset-0 w-full h-full object-contain"
                                    style={{ zIndex: layer.zIndex }}
                                    onClick={index === 0 ? onPlayPause : undefined}
                                    onTimeUpdate={() => handleTimeUpdate(layer.segment.id)}
                                    onEnded={index === 0 ? handleEnded : undefined}
                                    onLoadedData={() => {
                                        // When video loads, seek to correct position and resume if playing
                                        const video = videoRefs.current.get(layer.segment.id);
                                        if (video) {
                                            video.currentTime = layer.seekPosition;
                                            if (isPlaying) {
                                                video.play().catch(() => { });
                                            }
                                        }
                                    }}
                                    muted={true}
                                    preload="auto"
                                />
                            );
                        })}

                        {/* Preload upcoming videos for seamless playback */}
                        {segments
                            .filter(seg => {
                                // Only preload V1 segments coming up within 10 seconds
                                const isV1 = seg.trackId === 'v1';
                                const isUpcoming = seg.inSec > playheadSec && seg.inSec < playheadSec + 10;
                                const notActive = !activeVideoLayers.some(l => l.segment.id === seg.id);
                                return isV1 && isUpcoming && notActive;
                            })
                            .slice(0, 2) // Limit to 2 preloads
                            .map(seg => {
                                const url = getVideoUrl(seg);
                                if (!url) return null;
                                return (
                                    <video
                                        key={`preload-${seg.id}`}
                                        src={url}
                                        className="hidden"
                                        preload="auto"
                                        muted
                                    />
                                );
                            })
                        }

                        {/* Timecode Display */}
                        <div className="absolute top-4 right-4 text-sm font-mono bg-black/70 px-3 py-1.5 rounded text-white border border-white/10 tracking-widest z-50">
                            {formatTimecode(playheadSec)}
                        </div>

                        {/* Segment Info */}
                        <div className="absolute top-4 left-4 flex gap-2 z-50">
                            <div className="text-xs font-mono bg-purple-600/80 px-2 py-1 rounded text-white">
                                {topLayer?.segment.label}
                            </div>
                            {topLayer?.segment.mediaKind === 'rush' && (
                                <div className="text-xs font-mono bg-green-600/80 px-2 py-1 rounded text-white">
                                    RUSH
                                </div>
                            )}
                        </div>

                        {/* Play/Pause Overlay */}
                        {!isPlaying && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-40"
                                onClick={onPlayPause}
                            >
                                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-white text-5xl ml-1">play_arrow</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-gray-600">
                        <span className="material-symbols-outlined text-6xl mb-4">movie</span>
                        <p className="text-lg font-medium">Program Monitor</p>
                        <p className="text-sm mt-1">Ajoutez des segments à la timeline</p>
                        <p className="text-xs mt-4 text-gray-700">
                            ←/→ navigation frame • X split • Suppr delete
                        </p>
                    </div>
                )}
            </div>

            {/* Transport Controls */}
            <div className="h-14 bg-[#1a1a1a] border-t border-[#3f3f46] flex items-center justify-center gap-4 px-4">
                <button
                    onClick={() => onSeek(0)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Go to start (Home)"
                >
                    <span className="material-symbols-outlined text-lg">first_page</span>
                </button>
                <button
                    onClick={() => onSeek(Math.max(0, playheadSec - 1 / fps))}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Previous frame (←)"
                >
                    <span className="material-symbols-outlined text-lg">skip_previous</span>
                </button>
                <button
                    onClick={onPlayPause}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">
                        {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                </button>
                <button
                    onClick={() => onSeek(Math.min(totalDuration, playheadSec + 1 / fps))}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Next frame (→)"
                >
                    <span className="material-symbols-outlined text-lg">skip_next</span>
                </button>
                <button
                    onClick={() => onSeek(totalDuration)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Go to end (End)"
                >
                    <span className="material-symbols-outlined text-lg">last_page</span>
                </button>
            </div>
            {/* Audio Player (Hidden) */}
            <audio
                ref={audioRef}
                src={activeAudioSegment ? getVideoUrl(activeAudioSegment) || undefined : undefined}
                className="hidden"
                onEnded={onPlayPause}
            />
        </div>
    );
};

export default TimelinePreview;
