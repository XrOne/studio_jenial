/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ReactTimelineWrapper
 * Wrapper component that integrates @xzdarcy/react-timeline-editor
 * with our existing timeline state and UI
 */

'use client';

import * as React from 'react';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import { Timeline, TimelineRow, TimelineAction, TimelineEffect, TimelineState } from '@xzdarcy/react-timeline-editor';
import { SegmentWithUI, Track } from '../types/timeline';
import {
    segmentsToRows,
    rowsToSegments,
    computeTimelineDuration,
    SegmentActionData,
    DEFAULT_SCALE,
    MIN_SCALE,
    MAX_SCALE
} from '../utils/timelineAdapter';
import TimelineToolbar from './TimelineToolbar';

// === PROPS ===
interface ReactTimelineWrapperProps {
    segments: SegmentWithUI[];
    tracks: Track[];
    selectedSegmentIds: string[];
    playheadSec: number;
    onSegmentsChange: (segments: SegmentWithUI[]) => void;
    onPlayheadChange: (sec: number) => void;
    onSegmentSelect: (id: string) => void;
    onSegmentDoubleClick?: (id: string) => void;

    // Toolbar callbacks
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

// === CUSTOM RENDERERS ===
// Video clip renderer
const VideoClipRenderer: React.FC<{ action: TimelineAction; row: TimelineRow }> = ({ action }) => {
    const data = action.data as SegmentActionData | undefined;
    const thumbnailUrl = data?.thumbnailUrl || data?.originalSegment?.activeRevision?.thumbnailUrl;
    const label = data?.label || data?.originalSegment?.label || `Clip ${action.id.slice(0, 4)}`;

    return (
        <div className="w-full h-full flex items-center bg-gradient-to-b from-indigo-600/90 to-indigo-700/90 rounded overflow-hidden border border-indigo-500/50 shadow-sm">
            {thumbnailUrl && (
                <img
                    src={thumbnailUrl}
                    alt=""
                    className="h-full w-12 object-cover border-r border-indigo-500/30"
                />
            )}
            <span className="px-2 text-[10px] text-white truncate font-medium">
                {label}
            </span>
        </div>
    );
};

// Audio clip renderer
const AudioClipRenderer: React.FC<{ action: TimelineAction; row: TimelineRow }> = ({ action }) => {
    const data = action.data as SegmentActionData | undefined;
    const label = data?.label || `Audio ${action.id.slice(0, 4)}`;

    return (
        <div className="w-full h-full flex items-center bg-gradient-to-b from-emerald-600/90 to-emerald-700/90 rounded overflow-hidden border border-emerald-500/50">
            <div className="px-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-emerald-300">music_note</span>
                <span className="text-[10px] text-white truncate font-medium">{label}</span>
            </div>
        </div>
    );
};

// === MAIN COMPONENT ===
export const ReactTimelineWrapper: React.FC<ReactTimelineWrapperProps> = ({
    segments,
    tracks,
    selectedSegmentIds,
    playheadSec,
    onSegmentsChange,
    onPlayheadChange,
    onSegmentSelect,
    onSegmentDoubleClick,
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
}) => {
    const timelineRef = useRef<TimelineState>(null);
    const [scale, setScale] = React.useState(DEFAULT_SCALE);

    // Convert our data to library format
    const editorData = useMemo(() => segmentsToRows(segments, tracks), [segments, tracks]);

    // Calculate max duration
    const maxDuration = useMemo(() => computeTimelineDuration(segments), [segments]);

    // Define effects (track type renderers)
    const effects = useMemo<Record<string, TimelineEffect>>(() => ({
        v1: {
            id: 'v1',
            name: 'Video 1',
            source: {
                start: ({ action, row }) => VideoClipRenderer({ action, row }),
            }
        },
        v2: {
            id: 'v2',
            name: 'Video 2',
            source: {
                start: ({ action, row }) => VideoClipRenderer({ action, row }),
            }
        },
        a1: {
            id: 'a1',
            name: 'Audio 1',
            source: {
                start: ({ action, row }) => AudioClipRenderer({ action, row }),
            }
        },
        a2: {
            id: 'a2',
            name: 'Audio 2',
            source: {
                start: ({ action, row }) => AudioClipRenderer({ action, row }),
            }
        },
    }), []);

    // Handle data changes from the library
    const handleChange = useCallback((data: TimelineRow[]) => {
        const newSegments = rowsToSegments(data);
        onSegmentsChange(newSegments);
    }, [onSegmentsChange]);

    // Handle playhead/cursor changes
    const handleCursorChange = useCallback((time: number) => {
        onPlayheadChange(time);
    }, [onPlayheadChange]);

    // Handle action click (selection)
    const handleClickAction = useCallback((e: React.MouseEvent, { action }: { action: TimelineAction }) => {
        onSegmentSelect(action.id);
    }, [onSegmentSelect]);

    // Handle action double-click
    const handleDoubleClickAction = useCallback((e: React.MouseEvent, { action }: { action: TimelineAction }) => {
        onSegmentDoubleClick?.(action.id);
    }, [onSegmentDoubleClick]);

    // Handle zoom
    const handleScaleChange = useCallback((newScale: number) => {
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale)));
    }, []);

    // Sync playhead from external changes
    useEffect(() => {
        if (timelineRef.current) {
            timelineRef.current.setTime(playheadSec);
        }
    }, [playheadSec]);

    return (
        <div className={`flex flex-col h-full bg-[#1a1a1a] ${className}`}>
            {/* Toolbar */}
            <TimelineToolbar
                onUndo={onUndo}
                onRedo={onRedo}
                onCut={onCut}
                onRippleDelete={onRippleDelete}
                onExport={onExport}
                onSaveJson={onSaveJson}
                onLoadJson={onLoadJson}
                canUndo={canUndo}
                canRedo={canRedo}
                pixelsPerSecond={scale}
                onZoomChange={handleScaleChange}
            />

            {/* Timeline */}
            <div className="flex-1 overflow-hidden">
                <Timeline
                    ref={timelineRef}
                    editorData={editorData}
                    effects={effects}
                    onChange={handleChange}
                    onCursorDragEnd={handleCursorChange}
                    onClickAction={handleClickAction}
                    onDoubleClickAction={handleDoubleClickAction}
                    scale={scale}
                    scaleWidth={scale}
                    startLeft={60}
                    autoScroll={true}
                    hideCursor={false}
                    dragLine={true}
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#121212',
                    }}
                    // Grid settings
                    gridSnap={true}
                    // Row styling
                    getActionRender={(action, row) => {
                        const effectId = action.effectId;
                        if (effectId?.startsWith('a')) {
                            return <AudioClipRenderer action={action} row={row} />;
                        }
                        return <VideoClipRenderer action={action} row={row} />;
                    }}
                />
            </div>
        </div>
    );
};

export default ReactTimelineWrapper;
