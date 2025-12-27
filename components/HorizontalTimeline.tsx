/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HorizontalTimeline - Main timeline container
 * Combines ruler, tracks, playhead, and toolbar
 */
'use client';

import * as React from 'react';
import { SegmentWithUI, Track } from '../types/timeline';
import TimelineRuler from './TimelineRuler';
import TimelinePlayhead from './TimelinePlayhead';
import TimelineClip from './TimelineClip';
import TimelineToolbar from './TimelineToolbar';
import TrackHeader from './TrackHeader';

export interface HorizontalTimelineProps {
    tracks: Track[];
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    selectedTrackId: string | null;
    playheadSec: number;
    onPlayheadChange: (sec: number) => void;
    onSegmentClick: (id: string) => void;
    onSegmentDoubleClick?: (id: string) => void;
    onTrackSelect?: (trackId: string) => void;
    onTrackToggleLock?: (trackId: string) => void;
    onTrackToggleMute?: (trackId: string) => void;
    onTrackToggleVisible?: (trackId: string) => void;
    onSegmentTrim?: (segmentId: string, edge: 'start' | 'end', newTime: number) => void;
    onSegmentMove?: (segmentId: string, newInSec: number) => void;
    onDeleteGap?: (atSec: number, trackId: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onCut?: () => void;
    onRippleDelete?: () => void;
    onExport?: () => void;
    onSaveJson?: () => void;
    onLoadJson?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    className?: string;
}

const DEFAULT_PIXELS_PER_SECOND = 60;
const TRACK_HEIGHT = 56;
const TRACK_LABEL_WIDTH = 60;

/**
 * HorizontalTimeline
 * 
 * NLE-style horizontal timeline with:
 * - Toolbar with editing controls
 * - Time ruler with marks
 * - Multi-track support (V1, V2, A1, A2)
 * - Draggable playhead
 */
export default function HorizontalTimeline({
    tracks,
    segments,
    selectedSegmentIds,
    selectedTrackId,
    playheadSec,
    onPlayheadChange,
    onSegmentClick,
    onSegmentDoubleClick,
    onTrackSelect,
    onTrackToggleLock,
    onTrackToggleMute,
    onTrackToggleVisible,
    onSegmentTrim,
    onSegmentMove,
    onDeleteGap,
    onUndo,
    onRedo,
    onCut,
    onRippleDelete,
    onExport,
    onSaveJson,
    onLoadJson,
    canUndo = false,
    canRedo = false,
    className = '',
}: HorizontalTimelineProps) {
    const [pixelsPerSecond, setPixelsPerSecond] = React.useState(DEFAULT_PIXELS_PER_SECOND);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Calculate total duration from segments
    const totalDuration = React.useMemo(() => {
        if (segments.length === 0) return 30; // Default 30 seconds
        const maxEnd = Math.max(...segments.map(s => s.inSec + s.durationSec));
        return Math.max(maxEnd + 10, 30); // Add padding
    }, [segments]);

    const totalWidth = totalDuration * pixelsPerSecond;

    // Handle click on track area or ruler to move playhead
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Get the scrollable container's rect
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const rect = scrollContainer.getBoundingClientRect();
        const scrollLeft = scrollContainer.scrollLeft;

        // Calculate x position relative to timeline start
        const x = e.clientX - rect.left + scrollLeft;
        const newSec = Math.max(0, x / pixelsPerSecond);

        onPlayheadChange(newSec);
    };

    return (
        <div className={`flex flex-col bg-[#161616] border-t border-[#333] ${className}`}>
            {/* Toolbar */}
            <TimelineToolbar
                pixelsPerSecond={pixelsPerSecond}
                onZoomChange={setPixelsPerSecond}
                onUndo={onUndo}
                onRedo={onRedo}
                onCut={onCut}
                onRippleDelete={onRippleDelete}
                onExport={onExport}
                onSaveJson={onSaveJson}
                onLoadJson={onLoadJson}
                hasSelection={selectedSegmentIds.length > 0}
            />

            {/* Timeline area with synchronized scroll */}
            <div className="flex-1 flex overflow-hidden">
                {/* Track labels column with TrackHeader */}
                <div className="flex-shrink-0 bg-[#1a1a1a] border-r border-[#333]" style={{ width: TRACK_LABEL_WIDTH }}>
                    {/* Ruler spacer */}
                    <div className="h-7 border-b border-[#333]" />

                    {/* Dynamic track headers */}
                    {tracks.map(track => (
                        <TrackHeader
                            key={track.id}
                            track={track}
                            isSelected={selectedTrackId === track.id}
                            onSelect={() => onTrackSelect?.(track.id)}
                            onToggleLock={() => onTrackToggleLock?.(track.id)}
                            onToggleMute={() => onTrackToggleMute?.(track.id)}
                            onToggleVisible={() => onTrackToggleVisible?.(track.id)}
                        />
                    ))}
                </div>

                {/* Scrollable timeline content */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative"
                >
                    <div style={{ minWidth: `${totalWidth}px` }}>
                        {/* Ruler - clickable to position playhead */}
                        <TimelineRuler
                            durationSec={totalDuration}
                            pixelsPerSecond={pixelsPerSecond}
                            onClick={onPlayheadChange}
                        />

                        {/* Dynamic tracks with segments */}
                        {tracks.map(track => {
                            const trackSegments = segments.filter(s => s.trackId === track.id);
                            const isVideoTrack = track.type === 'video';

                            return (
                                <div
                                    key={track.id}
                                    className={`relative border-b border-[#333] cursor-pointer ${isVideoTrack ? 'bg-[#1e1e1e]' : 'bg-[#161616]'
                                        } ${track.locked ? 'opacity-60' : ''} ${!track.visible && isVideoTrack ? 'opacity-30' : ''
                                        }`}
                                    style={{ height: track.height, minWidth: `${totalWidth}px` }}
                                    onClick={handleTimelineClick}
                                >
                                    {/* Grid lines */}
                                    <div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            backgroundImage: `repeating-linear-gradient(
                                                to right,
                                                transparent,
                                                transparent ${pixelsPerSecond * 5 - 1}px,
                                                #2a2a2a ${pixelsPerSecond * 5 - 1}px,
                                                #2a2a2a ${pixelsPerSecond * 5}px
                                            )`,
                                        }}
                                    />

                                    {/* Segments for this track */}
                                    {trackSegments.map((segment) => (
                                        <TimelineClip
                                            key={segment.id}
                                            segment={segment}
                                            isSelected={selectedSegmentIds.includes(segment.id)}
                                            pixelsPerSecond={pixelsPerSecond}
                                            trackHeight={track.height}
                                            onClick={() => onSegmentClick(segment.id)}
                                            onDoubleClick={onSegmentDoubleClick ? () => onSegmentDoubleClick(segment.id) : undefined}
                                        />
                                    ))}

                                    {/* Audio waveform placeholder for audio tracks */}
                                    {!isVideoTrack && trackSegments.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-[9px] pointer-events-none">
                                            Audio {track.muted ? '(muted)' : ''}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Playhead - spans entire height */}
                        <TimelinePlayhead
                            positionSec={playheadSec}
                            pixelsPerSecond={pixelsPerSecond}
                            height={tracks.reduce((h, t) => h + t.height, 0) + 28} // All tracks + ruler
                            onDrag={onPlayheadChange}
                        />
                    </div>
                </div>
            </div>

            {/* Status bar */}
            <div className="h-6 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-between px-3">
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span>{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
                    <span>Durée: {formatDuration(totalDuration - 10)}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                    {formatTimecode(playheadSec)}
                </div>
            </div>
        </div>
    );
}

/**
 * Format seconds to MM:SS
 */
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format seconds to MM:SS:FF
 */
const formatTimecode = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};
