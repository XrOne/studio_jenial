/**
 * TimelinePreview Component
 * Real-time video preview synchronized with timeline playhead
 * Shows the current frame at the playhead position
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SegmentWithUI } from '../types/timeline';

interface TimelinePreviewProps {
    segments: SegmentWithUI[];
    playheadSec: number;
    isPlaying: boolean;
    onPlayPause: () => void;
    onSeek: (sec: number) => void;
    fps: number;
}

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
    segments,
    playheadSec,
    isPlaying,
    onPlayPause,
    onSeek,
    fps
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentSegment, setCurrentSegment] = useState<SegmentWithUI | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // Format timecode (HH:MM:SS:FF)
    const formatTimecode = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const f = Math.floor((seconds % 1) * fps);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    };

    // Find segment at current playhead position
    useEffect(() => {
        const segment = segments.find(s =>
            playheadSec >= s.inSec && playheadSec < s.outSec
        );

        if (segment !== currentSegment) {
            setCurrentSegment(segment || null);

            // Get video URL from segment
            if (segment?.activeRevision?.videoUrl) {
                setVideoUrl(segment.activeRevision.videoUrl);
            } else if (segment?.activeRevision?.outputAsset?.url) {
                setVideoUrl(segment.activeRevision.outputAsset.url);
            } else {
                setVideoUrl(null);
            }
        }
    }, [segments, playheadSec, currentSegment]);

    // Sync video position with playhead
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentSegment || !videoUrl) return;

        // Calculate position within the segment
        const positionInSegment = playheadSec - currentSegment.inSec;

        // Only seek if not playing and position differs significantly
        if (!isPlaying && Math.abs(video.currentTime - positionInSegment) > 0.05) {
            video.currentTime = positionInSegment;
        }
    }, [playheadSec, currentSegment, isPlaying, videoUrl]);

    // Handle play/pause
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying]);

    // Handle video time update during playback
    const handleTimeUpdate = useCallback(() => {
        if (!isPlaying || !currentSegment) return;
        const video = videoRef.current;
        if (!video) return;

        const newPlayheadPos = currentSegment.inSec + video.currentTime;
        onSeek(newPlayheadPos);
    }, [isPlaying, currentSegment, onSeek]);

    // Handle video ended
    const handleEnded = useCallback(() => {
        // Find next segment
        if (!currentSegment) return;
        const currentIndex = segments.findIndex(s => s.id === currentSegment.id);
        if (currentIndex < segments.length - 1) {
            const nextSegment = segments[currentIndex + 1];
            onSeek(nextSegment.inSec);
        } else {
            onPlayPause(); // Stop at end
        }
    }, [currentSegment, segments, onSeek, onPlayPause]);

    return (
        <div className="flex-1 bg-black flex flex-col min-w-0 relative border-r border-[#3f3f46]">
            {/* Header */}
            <div className="h-10 bg-[#1e1e1e] border-b border-[#3f3f46] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">
                        {currentSegment?.label || 'Timeline Preview'}
                    </span>
                    <div className="h-3 w-px bg-gray-700"></div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-600 rounded text-white font-mono">PROGRAM</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{segments.length} segments</span>
                </div>
            </div>

            {/* Video Display */}
            <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a]">
                {videoUrl && currentSegment ? (
                    <div className="aspect-video w-full h-full max-h-[90%] max-w-[95%] relative shadow-2xl bg-black">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="w-full h-full object-contain"
                            onClick={onPlayPause}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleEnded}
                            muted={false}
                        />

                        {/* Timecode Display */}
                        <div className="absolute top-4 right-4 text-sm font-mono bg-black/70 px-3 py-1.5 rounded text-white border border-white/10 tracking-widest z-10">
                            {formatTimecode(playheadSec)}
                        </div>

                        {/* Segment Info */}
                        <div className="absolute top-4 left-4 flex gap-2 z-10">
                            <div className="text-xs font-mono bg-purple-600/80 px-2 py-1 rounded text-white">
                                {currentSegment.label}
                            </div>
                        </div>

                        {/* Play/Pause Overlay */}
                        {!isPlaying && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
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
                        <p className="text-lg font-medium">Timeline Preview</p>
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
                    onClick={() => onSeek(Math.max(0, playheadSec - 5))}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">fast_rewind</span>
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
                    onClick={() => onSeek(playheadSec + 5)}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">fast_forward</span>
                </button>
                <button
                    onClick={() => {
                        const lastSegment = segments[segments.length - 1];
                        if (lastSegment) onSeek(lastSegment.outSec);
                    }}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Go to end (End)"
                >
                    <span className="material-symbols-outlined text-lg">last_page</span>
                </button>
            </div>
        </div>
    );
};

export default TimelinePreview;
