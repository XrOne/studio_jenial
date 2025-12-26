/**
 * SourceViewer Component
 * Professional NLE-style source viewer with In/Out point editing
 * 
 * Shortcuts:
 * - I: Set In point
 * - O: Set Out point
 * - Space: Play/Pause
 * - J: Rewind
 * - K: Pause
 * - L: Forward
 * - B: Overwrite to timeline
 * - V: Insert to timeline
 * - Home: Go to start
 * - End: Go to end
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RushMedia } from '../types/media';

interface SourceViewerProps {
    media: RushMedia | null;
    onClose: () => void;
    onInsert: (media: RushMedia, inPoint: number, outPoint: number) => void;
    onOverwrite: (media: RushMedia, inPoint: number, outPoint: number) => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
    media,
    onClose,
    onInsert,
    onOverwrite
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [inPoint, setInPoint] = useState<number | null>(null);
    const [outPoint, setOutPoint] = useState<number | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);

    // Format timecode (HH:MM:SS:FF)
    const formatTimecode = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const f = Math.floor((seconds % 1) * 30); // Assuming 30fps
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    };

    // Handle video time update
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleLoadedMetadata = () => setDuration(video.duration);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('ended', handleEnded);
        };
    }, [media]);

    // Reset state when media changes
    useEffect(() => {
        setInPoint(null);
        setOutPoint(null);
        setCurrentTime(0);
        setIsPlaying(false);
        setPlaybackRate(1);
    }, [media]);

    // Play/Pause toggle
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    }, []);

    // Seek to position
    const seekTo = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(time, duration));
    }, [duration]);

    // Set In point
    const setIn = useCallback(() => {
        setInPoint(currentTime);
        // If out point is before in, reset it
        if (outPoint !== null && outPoint < currentTime) {
            setOutPoint(null);
        }
    }, [currentTime, outPoint]);

    // Set Out point
    const setOut = useCallback(() => {
        setOutPoint(currentTime);
        // If in point is after out, reset it
        if (inPoint !== null && inPoint > currentTime) {
            setInPoint(null);
        }
    }, [currentTime, inPoint]);

    // Clear In/Out points
    const clearInOut = useCallback(() => {
        setInPoint(null);
        setOutPoint(null);
    }, []);

    // Go to In point
    const goToIn = useCallback(() => {
        if (inPoint !== null) seekTo(inPoint);
    }, [inPoint, seekTo]);

    // Go to Out point
    const goToOut = useCallback(() => {
        if (outPoint !== null) seekTo(outPoint);
    }, [outPoint, seekTo]);

    // Handle Insert (V)
    const handleInsert = useCallback(() => {
        if (!media) return;
        const startTime = inPoint ?? 0;
        const endTime = outPoint ?? duration;
        onInsert(media, startTime, endTime);
    }, [media, inPoint, outPoint, duration, onInsert]);

    // Handle Overwrite (B)
    const handleOverwrite = useCallback(() => {
        if (!media) return;
        const startTime = inPoint ?? 0;
        const endTime = outPoint ?? duration;
        onOverwrite(media, startTime, endTime);
    }, [media, inPoint, outPoint, duration, onOverwrite]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if typing in input
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            const video = videoRef.current;
            if (!video) return;

            switch (e.key.toLowerCase()) {
                case 'i':
                    e.preventDefault();
                    setIn();
                    break;
                case 'o':
                    e.preventDefault();
                    setOut();
                    break;
                case 'b':
                    e.preventDefault();
                    handleOverwrite();
                    break;
                case 'v':
                    e.preventDefault();
                    handleInsert();
                    break;
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'home':
                    e.preventDefault();
                    seekTo(0);
                    break;
                case 'end':
                    e.preventDefault();
                    seekTo(duration);
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    seekTo(currentTime - (e.shiftKey ? 1 : 1 / 30));
                    break;
                case 'arrowright':
                    e.preventDefault();
                    seekTo(currentTime + (e.shiftKey ? 1 : 1 / 30));
                    break;
                case 'escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setIn, setOut, handleInsert, handleOverwrite, togglePlay, seekTo, currentTime, duration, playbackRate, onClose]);

    // Handle progress bar click
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        seekTo(percentage * duration);
    };

    if (!media) return null;

    const effectiveIn = inPoint ?? 0;
    const effectiveOut = outPoint ?? duration;
    const selectionDuration = effectiveOut - effectiveIn;

    return (
        <div className="flex-1 bg-black flex flex-col min-w-0 relative border-r border-[#3f3f46]">
            {/* Header */}
            <div className="h-10 bg-[#1e1e1e] border-b border-[#3f3f46] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]">{media.name}</span>
                    <div className="h-3 w-px bg-gray-700"></div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600 rounded text-white font-mono">SOURCE</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            </div>

            {/* Video Player */}
            <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a]">
                <div className="aspect-video w-full h-full max-h-[90%] max-w-[95%] relative shadow-2xl bg-black">
                    <video
                        ref={videoRef}
                        src={media.localUrl}
                        className="w-full h-full object-contain"
                        onClick={togglePlay}
                    />

                    {/* Timecode Display */}
                    <div className="absolute top-4 right-4 text-sm font-mono bg-black/70 px-3 py-1.5 rounded text-white border border-white/10 tracking-widest z-10">
                        {formatTimecode(currentTime)}
                    </div>

                    {/* In/Out Display */}
                    <div className="absolute top-4 left-4 flex gap-2 z-10">
                        {inPoint !== null && (
                            <div className="text-xs font-mono bg-green-600/80 px-2 py-1 rounded text-white">
                                IN: {formatTimecode(inPoint)}
                            </div>
                        )}
                        {outPoint !== null && (
                            <div className="text-xs font-mono bg-red-600/80 px-2 py-1 rounded text-white">
                                OUT: {formatTimecode(outPoint)}
                            </div>
                        )}
                        {(inPoint !== null || outPoint !== null) && (
                            <div className="text-xs font-mono bg-blue-600/80 px-2 py-1 rounded text-white">
                                DUR: {formatTimecode(selectionDuration)}
                            </div>
                        )}
                    </div>

                    {/* Play/Pause Overlay */}
                    {!isPlaying && (
                        <div
                            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                            onClick={togglePlay}
                        >
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <span className="material-symbols-outlined text-white text-5xl ml-1">play_arrow</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar & Controls */}
            <div className="h-24 bg-[#1a1a1a] border-t border-[#3f3f46] p-3">
                {/* Progress Bar */}
                <div
                    ref={progressRef}
                    className="h-8 bg-gray-900 rounded-lg relative cursor-pointer mb-3 overflow-hidden"
                    onClick={handleProgressClick}
                >
                    {/* In/Out Range Highlight */}
                    {(inPoint !== null || outPoint !== null) && duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 bg-indigo-600/30"
                            style={{
                                left: `${(effectiveIn / duration) * 100}%`,
                                width: `${(selectionDuration / duration) * 100}%`
                            }}
                        />
                    )}

                    {/* In Marker */}
                    {inPoint !== null && duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-green-500 z-10"
                            style={{ left: `${(inPoint / duration) * 100}%` }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-green-400 font-bold">I</div>
                        </div>
                    )}

                    {/* Out Marker */}
                    {outPoint !== null && duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-1 bg-red-500 z-10"
                            style={{ left: `${(outPoint / duration) * 100}%` }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] text-red-400 font-bold">O</div>
                        </div>
                    )}

                    {/* Playhead */}
                    {duration > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white z-20"
                            style={{ left: `${(currentTime / duration) * 100}%` }}
                        >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                        </div>
                    )}

                    {/* Progress Fill */}
                    {duration > 0 && (
                        <div
                            className="absolute top-0 left-0 bottom-0 bg-gray-700"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                    )}
                </div>

                {/* Transport Controls */}
                <div className="flex items-center justify-between">
                    {/* Left: Timecode & Duration */}
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                        <span>{formatTimecode(currentTime)}</span>
                        <span className="text-gray-600">/</span>
                        <span>{formatTimecode(duration)}</span>
                    </div>

                    {/* Center: Transport Buttons */}
                    <div className="flex items-center gap-2">
                        <button onClick={goToIn} className="p-1.5 text-gray-400 hover:text-green-400 transition-colors" title="Go to In (Shift+I)">
                            <span className="material-symbols-outlined text-lg">first_page</span>
                        </button>
                        <button onClick={() => seekTo(currentTime - 5)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">fast_rewind</span>
                        </button>
                        <button onClick={togglePlay} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>
                        <button onClick={() => seekTo(currentTime + 5)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">fast_forward</span>
                        </button>
                        <button onClick={goToOut} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors" title="Go to Out (Shift+O)">
                            <span className="material-symbols-outlined text-lg">last_page</span>
                        </button>
                    </div>

                    {/* Right: In/Out & Insert Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={setIn}
                            className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded font-medium transition-colors"
                            title="Set In Point (I)"
                        >
                            I - In
                        </button>
                        <button
                            onClick={setOut}
                            className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-medium transition-colors"
                            title="Set Out Point (O)"
                        >
                            O - Out
                        </button>
                        <div className="w-px h-5 bg-gray-700 mx-1" />
                        <button
                            onClick={handleOverwrite}
                            className="px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded font-medium transition-colors"
                            title="Overwrite to Timeline (B)"
                        >
                            B - Écraser
                        </button>
                        <button
                            onClick={handleInsert}
                            className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded font-medium transition-colors"
                            title="Insert to Timeline (V)"
                        >
                            V - Insérer
                        </button>
                        {(inPoint !== null || outPoint !== null) && (
                            <button
                                onClick={clearInOut}
                                className="p-1 text-gray-500 hover:text-white transition-colors"
                                title="Clear In/Out"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SourceViewer;
