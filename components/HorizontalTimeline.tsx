/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HorizontalTimeline - Main timeline container
 * Combines ruler, tracks, playhead, and toolbar
 */
'use client';

import * as React from 'react';
import { SegmentWithUI, Track, DEFAULT_FPS } from '../types/timeline';
import TimelineRuler from './TimelineRuler';
import TimelinePlayhead from './TimelinePlayhead';
import TimelineClip from './TimelineClip';
import TimelineToolbar from './TimelineToolbar';
import TrackHeader from './TrackHeader';
import { buildTrackItems } from '../utils/otioUtils';
import { rationalTimeToSeconds } from '../types/otio';

export interface HorizontalTimelineProps {
    tracks: Track[];
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    selectedTrackId: string | null;
    playheadSec: number;
    fps: number; // Project FPS for timecode display
    onPlayheadChange: (sec: number) => void;
    onSegmentClick: (id: string) => void;
    onSegmentDoubleClick?: (id: string) => void;
    onTrackSelect?: (trackId: string) => void;
    onTrackToggleLock?: (trackId: string) => void;
    onTrackToggleMute?: (trackId: string) => void;
    onTrackToggleVisible?: (trackId: string) => void;
    onSegmentTrim?: (segmentId: string, edge: 'start' | 'end', newTime: number, trimMode?: string) => void;
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
    fps,
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

    // Premiere Pro-style toggles
    const [linkedSelection, setLinkedSelection] = React.useState(true);
    const [snappingEnabled, setSnappingEnabled] = React.useState(true);
    const SNAP_THRESHOLD_PX = 10;

    // Trim mode state
    type TrimMode = 'normal' | 'ripple' | 'roll' | 'slip' | 'slide';
    const [trimMode, setTrimMode] = React.useState<TrimMode>('normal');

    // 3-Point Edit state
    const [timelineIn, setTimelineIn] = React.useState<number | null>(null);
    const [timelineOut, setTimelineOut] = React.useState<number | null>(null);

    // Drag handling refs
    const dragState = React.useRef<{
        segmentId: string;
        startX: number;
        originalInSec: number;
        pps: number;
        linkedSegmentIds: string[];
    } | null>(null);

    // Trim handling refs
    const trimState = React.useRef<{
        segmentId: string;
        edge: 'left' | 'right';
        startX: number;
        originalInSec: number;
        originalOutSec: number;
        originalSourceIn: number;
        originalSourceOut: number;
        pps: number;
    } | null>(null);

    // Keep callback refs stable
    const onSegmentMoveRef = React.useRef(onSegmentMove);
    React.useEffect(() => { onSegmentMoveRef.current = onSegmentMove; }, [onSegmentMove]);

    const onSegmentTrimRef = React.useRef(onSegmentTrim);
    React.useEffect(() => { onSegmentTrimRef.current = onSegmentTrim; }, [onSegmentTrim]);

    const handleDragMove = React.useCallback((e: MouseEvent) => {
        if (!dragState.current) return;
        const { segmentId, startX, originalInSec, pps, linkedSegmentIds } = dragState.current;

        const deltaX = e.clientX - startX;
        let deltaSec = deltaX / pps;
        let newInSec = Math.max(0, originalInSec + deltaSec);

        // Snapping logic
        if (snappingEnabled) {
            const candidateEdges: number[] = [playheadSec];
            // Collect edges from all other segments
            for (const seg of segments) {
                if (!linkedSegmentIds.includes(seg.id) && seg.id !== segmentId) {
                    candidateEdges.push(seg.inSec, seg.outSec);
                }
            }
            // Calculate new segment outSec for snapping
            const draggedSeg = segments.find(s => s.id === segmentId);
            const duration = draggedSeg?.durationSec ?? 0;
            const newOutSec = newInSec + duration;

            // Snap inSec to edges
            for (const edge of candidateEdges) {
                if (Math.abs(newInSec - edge) * pps < SNAP_THRESHOLD_PX) {
                    newInSec = edge;
                    break;
                }
                // Snap outSec to edges
                if (Math.abs(newOutSec - edge) * pps < SNAP_THRESHOLD_PX) {
                    newInSec = edge - duration;
                    break;
                }
            }
        }

        // Move all linked segments
        for (const id of linkedSegmentIds) {
            const seg = segments.find(s => s.id === id);
            if (seg) {
                const offset = seg.inSec - originalInSec;
                onSegmentMoveRef.current?.(id, newInSec + offset);
            }
        }
        // Move the primary segment
        onSegmentMoveRef.current?.(segmentId, newInSec);
    }, [snappingEnabled, playheadSec, segments, SNAP_THRESHOLD_PX]);

    const handleDragEnd = React.useCallback(() => {
        dragState.current = null;
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        // Reset cursor
        document.body.style.cursor = '';
    }, [handleDragMove]);

    const handleClipMouseDown = (e: React.MouseEvent, segmentId: string) => {
        e.stopPropagation(); // Prevent timeline click

        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return;

        // Find all linked segments (same linkGroupId)
        let linkedSegmentIds: string[] = [];
        if (linkedSelection && segment.linkGroupId) {
            linkedSegmentIds = segments
                .filter(s => s.linkGroupId === segment.linkGroupId && s.id !== segmentId)
                .map(s => s.id);
        }

        dragState.current = {
            segmentId,
            startX: e.clientX,
            originalInSec: segment.inSec,
            pps: pixelsPerSecond,
            linkedSegmentIds
        };

        document.body.style.cursor = 'grabbing';
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    };

    // === TRIM HANDLERS ===
    const handleTrimMove = React.useCallback((e: MouseEvent) => {
        if (!trimState.current) return;
        const { segmentId, edge, startX, originalInSec, originalOutSec, pps } = trimState.current;

        const deltaX = e.clientX - startX;
        const deltaSec = deltaX / pps;

        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return;

        if (edge === 'left') {
            // Trimming the left edge (start point)
            let newInSec = Math.max(0, originalInSec + deltaSec);
            newInSec = Math.min(newInSec, originalOutSec - 0.1);

            // Pass trimMode to callback
            onSegmentTrimRef.current?.(segmentId, 'start', newInSec, trimMode);
        } else {
            // Trimming the right edge (end point)
            let newOutSec = Math.max(originalInSec + 0.1, originalOutSec + deltaSec);

            // Pass trimMode to callback
            onSegmentTrimRef.current?.(segmentId, 'end', newOutSec, trimMode);
        }
    }, [segments, trimMode]);

    const handleTrimEnd = React.useCallback(() => {
        trimState.current = null;
        window.removeEventListener('mousemove', handleTrimMove);
        window.removeEventListener('mouseup', handleTrimEnd);
        document.body.style.cursor = '';
    }, [handleTrimMove]);

    const handleTrimStart = (edge: 'left' | 'right', e: React.MouseEvent, segmentId: string) => {
        e.stopPropagation();
        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return;

        trimState.current = {
            segmentId,
            edge,
            startX: e.clientX,
            originalInSec: segment.inSec,
            originalOutSec: segment.outSec,
            originalSourceIn: segment.sourceInSec ?? 0,
            originalSourceOut: segment.sourceOutSec ?? segment.durationSec,
            pps: pixelsPerSecond
        };

        document.body.style.cursor = 'ew-resize';
        window.addEventListener('mousemove', handleTrimMove);
        window.addEventListener('mouseup', handleTrimEnd);
    };

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
                linkedSelection={linkedSelection}
                onLinkedSelectionToggle={() => setLinkedSelection(prev => !prev)}
                snapping={snappingEnabled}
                onSnappingToggle={() => setSnappingEnabled(prev => !prev)}
                trimMode={trimMode}
                onTrimModeChange={setTrimMode}
                timelineIn={timelineIn}
                timelineOut={timelineOut}
                onSetTimelineIn={() => setTimelineIn(playheadSec)}
                onSetTimelineOut={() => setTimelineOut(playheadSec)}
                onClearTimelineMarks={() => { setTimelineIn(null); setTimelineOut(null); }}
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

                                    {/* Segments and Gaps for this track */}
                                    {(() => {
                                        const trackItems = buildTrackItems(trackSegments);
                                        let currentPosition = 0;

                                        return trackItems.map((trackItem, idx) => {
                                            if (trackItem.type === 'gap') {
                                                const gapDuration = rationalTimeToSeconds(trackItem.item.duration);
                                                const gapStart = currentPosition;
                                                currentPosition += gapDuration;

                                                return (
                                                    <div
                                                        key={`gap-${trackItem.item.id}`}
                                                        className="absolute top-1 bottom-1 bg-[#2a2a3a]/40 border border-dashed border-[#4a4a5a] rounded hover:bg-[#3a3a4a]/60 hover:border-[#6a6a7a] transition-colors cursor-copy"
                                                        style={{
                                                            left: `${gapStart * pixelsPerSecond}px`,
                                                            width: `${gapDuration * pixelsPerSecond}px`
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Click on gap moves playhead to gap start
                                                            onPlayheadChange(gapStart);
                                                        }}
                                                        title={`Gap: ${gapDuration.toFixed(2)}s - Click pour positionner, drop pour insérer`}
                                                    >
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                            <span className="text-[8px] text-gray-400 uppercase tracking-wider">Drop Zone</span>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                const segment = trackSegments.find(s => s.id === trackItem.item.id);
                                                if (!segment) return null;
                                                currentPosition = segment.outSec;

                                                return (
                                                    <TimelineClip
                                                        key={segment.id}
                                                        segment={segment}
                                                        isSelected={selectedSegmentIds.includes(segment.id)}
                                                        pixelsPerSecond={pixelsPerSecond}
                                                        trackHeight={track.height}
                                                        trimMode={trimMode}
                                                        onClick={() => onSegmentClick(segment.id)}
                                                        onDoubleClick={onSegmentDoubleClick ? () => onSegmentDoubleClick(segment.id) : undefined}
                                                        onMouseDown={(e) => handleClipMouseDown(e, segment.id)}
                                                        onTrimStart={(edge, e) => handleTrimStart(edge, e, segment.id)}
                                                    />
                                                );
                                            }
                                        });
                                    })()}

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
                            fps={fps}
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
                    {formatTimecode(playheadSec, fps)}
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
const formatTimecode = (seconds: number, fps: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * fps);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};
