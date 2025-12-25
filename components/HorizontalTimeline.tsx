/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HorizontalTimeline - Main timeline container
 * Combines ruler, tracks, playhead, and toolbar
 */
'use client';

import * as React from 'react';
import { SegmentWithUI } from '../types/timeline';
import TimelineRuler from './TimelineRuler';
import TimelinePlayhead from './TimelinePlayhead';
import TimelineClip from './TimelineClip';
import TimelineToolbar from './TimelineToolbar';

export interface HorizontalTimelineProps {
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    playheadSec: number;
    onPlayheadChange: (sec: number) => void;
    onSegmentClick: (id: string) => void;
    onSegmentDoubleClick?: (id: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onCut?: () => void;
    onRippleDelete?: () => void;
    onExport?: () => void; // New prop
    className?: string;
}

const DEFAULT_PIXELS_PER_SECOND = 60;
const TRACK_HEIGHT = 56;
const TRACK_LABEL_WIDTH = 48;

/**
 * HorizontalTimeline
 * 
 * NLE-style horizontal timeline with:
 * - Toolbar with editing controls
 * - Time ruler with marks
 * - Video track (V1) with clips
 * - Draggable playhead
 */
export default function HorizontalTimeline({
    segments,
    selectedSegmentIds,
    playheadSec,
    onPlayheadChange,
    onSegmentClick,
    onSegmentDoubleClick,
    onUndo,
    onRedo,
    onCut,
    onRippleDelete,
    onExport,
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

    // Handle click on empty track area to move playhead
    const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
        const x = e.clientX - rect.left + scrollLeft - TRACK_LABEL_WIDTH;
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
                hasSelection={selectedSegmentIds.length > 0}
            />

            {/* Timeline area with synchronized scroll */}
            <div className="flex-1 flex overflow-hidden">
                {/* Track labels column */}
                <div className="flex-shrink-0 bg-[#1a1a1a] border-r border-[#333]" style={{ width: TRACK_LABEL_WIDTH }}>
                    {/* Ruler spacer */}
                    <div className="h-7 border-b border-[#333]" />

                    {/* V1 label */}
                    <div
                        className="flex items-center justify-center border-b border-[#333] text-[10px] font-bold text-gray-500"
                        style={{ height: TRACK_HEIGHT }}
                    >
                        V1
                    </div>

                    {/* A1 label (placeholder) */}
                    <div
                        className="flex items-center justify-center border-b border-[#333] text-[10px] font-bold text-gray-600"
                        style={{ height: 32 }}
                    >
                        A1
                    </div>
                </div>

                {/* Scrollable timeline content */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto overflow-y-hidden relative"
                >
                    <div style={{ minWidth: `${totalWidth}px` }}>
                        {/* Ruler */}
                        <TimelineRuler
                            durationSec={totalDuration}
                            pixelsPerSecond={pixelsPerSecond}
                        />

                        {/* Video Track V1 */}
                        <div
                            className="relative bg-[#1e1e1e] border-b border-[#333] cursor-pointer"
                            style={{ height: TRACK_HEIGHT, minWidth: `${totalWidth}px` }}
                            onClick={handleTrackClick}
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

                            {/* Clips */}
                            {segments.map((segment) => (
                                <TimelineClip
                                    key={segment.id}
                                    segment={segment}
                                    isSelected={selectedSegmentIds.includes(segment.id)}
                                    pixelsPerSecond={pixelsPerSecond}
                                    trackHeight={TRACK_HEIGHT}
                                    onClick={() => onSegmentClick(segment.id)}
                                    onDoubleClick={onSegmentDoubleClick ? () => onSegmentDoubleClick(segment.id) : undefined}
                                />
                            ))}
                        </div>

                        {/* Audio Track A1 (placeholder) */}
                        <div
                            className="relative bg-[#161616] border-b border-[#333]"
                            style={{ height: 32, minWidth: `${totalWidth}px` }}
                        >
                            <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-[9px]">
                                Audio track (coming soon)
                            </div>
                        </div>

                        {/* Playhead - spans entire height */}
                        <TimelinePlayhead
                            positionSec={playheadSec}
                            pixelsPerSecond={pixelsPerSecond}
                            height={TRACK_HEIGHT + 32 + 28} // V1 + A1 + ruler
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
