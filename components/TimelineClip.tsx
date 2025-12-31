/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelineClip - Individual clip on the timeline track
 * Displays segment thumbnail, label, status, and trim handles
 */
'use client';

import * as React from 'react';
import { SegmentWithUI } from '../types/timeline';

export type TrimMode = 'normal' | 'ripple' | 'roll' | 'slip' | 'slide';

interface TimelineClipProps {
    segment: SegmentWithUI;
    isSelected: boolean;
    pixelsPerSecond: number;
    trackHeight: number;
    trimMode?: TrimMode;
    onClick: () => void;
    onDoubleClick?: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onTrimStart?: (edge: 'left' | 'right', e: React.MouseEvent) => void;
}

/**
 * Get status color for clip border
 */
const getStatusColor = (status?: string): string => {
    switch (status) {
        case 'succeeded': return 'border-green-600/50';
        case 'running': return 'border-blue-500/50';
        case 'failed': return 'border-red-600/50';
        case 'queued': return 'border-gray-600/50';
        default: return 'border-gray-600';
    }
};

/**
 * TimelineClip
 * 
 * Visual representation of a segment on the horizontal timeline.
 * Shows thumbnail, label, duration, and interactive trim handles.
 */
export default function TimelineClip({
    segment,
    isSelected,
    pixelsPerSecond,
    trackHeight,
    trimMode = 'normal',
    onClick,
    onDoubleClick,
    onMouseDown,
    onTrimStart,
}: TimelineClipProps) {
    const width = segment.durationSec * pixelsPerSecond;
    const left = segment.inSec * pixelsPerSecond;

    // Get thumbnail from active revision
    const thumbnailUrl = segment.activeRevision?.thumbnailUrl
        || segment.activeRevision?.outputAsset?.url
        || segment.activeRevision?.videoUrl;
    const status = segment.activeRevision?.status || 'draft';

    // Trim handle cursor based on mode
    const getTrimCursor = () => {
        switch (trimMode) {
            case 'ripple': return 'ew-resize';
            case 'roll': return 'col-resize';
            case 'slip': return 'move';
            case 'slide': return 'grab';
            default: return 'ew-resize';
        }
    };

    const handleLeftTrim = (e: React.MouseEvent) => {
        e.stopPropagation();
        onTrimStart?.('left', e);
    };

    const handleRightTrim = (e: React.MouseEvent) => {
        e.stopPropagation();
        onTrimStart?.('right', e);
    };

    return (
        <div
            className={`
        absolute rounded-md overflow-hidden cursor-pointer
        transition-all duration-150 ease-out
        bg-gray-800 border group
        ${getStatusColor(status)}
        ${isSelected
                    ? 'ring-2 ring-primary border-primary shadow-xl scale-[1.02] z-10'
                    : 'hover:ring-1 hover:ring-white/50'
                }
      `}
            style={{
                left: `${left}px`,
                width: `${Math.max(width, 40)}px`,
                height: `${trackHeight - 8}px`,
                top: '4px',
            }}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseDown={onMouseDown}
        >
            {/* Left Trim Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-2 bg-yellow-500/0 hover:bg-yellow-500/60 
                           transition-colors cursor-ew-resize z-20 opacity-0 group-hover:opacity-100"
                style={{ cursor: getTrimCursor() }}
                onMouseDown={handleLeftTrim}
                title={`Trim Start (${trimMode})`}
            >
                <div className="absolute inset-y-0 left-0 w-1 bg-yellow-400/80" />
            </div>

            {/* Right Trim Handle */}
            <div
                className="absolute right-0 top-0 bottom-0 w-2 bg-yellow-500/0 hover:bg-yellow-500/60 
                           transition-colors cursor-ew-resize z-20 opacity-0 group-hover:opacity-100"
                style={{ cursor: getTrimCursor() }}
                onMouseDown={handleRightTrim}
                title={`Trim End (${trimMode})`}
            >
                <div className="absolute inset-y-0 right-0 w-1 bg-yellow-400/80" />
            </div>

            {/* Thumbnail background */}
            {thumbnailUrl ? (
                <img
                    src={thumbnailUrl}
                    alt={segment.label || 'Clip'}
                    className={`
            w-full h-full object-cover
            ${isSelected ? 'opacity-100' : 'opacity-60 grayscale-[20%]'}
          `}
                />
            ) : (
                <div className={`
          w-full h-full flex items-center justify-center
          bg-gradient-to-br from-gray-700 to-gray-900
          ${isSelected ? '' : 'opacity-60'}
        `}>
                    <span className="material-symbols-outlined text-gray-500 text-2xl">
                        movie
                    </span>
                </div>
            )}

            {/* Label bar at bottom */}
            <div className={`
        absolute bottom-0 left-0 right-0 h-4
        px-1.5 flex items-center
        backdrop-blur-sm border-t border-white/10
        ${isSelected ? 'bg-primary/40' : 'bg-blue-900/60'}
      `}>
                <span className={`
          text-[9px] font-medium truncate
          ${isSelected ? 'text-white' : 'text-blue-100'}
        `}>
                    {segment.label || `Segment ${segment.order}`}
                </span>
            </div>

            {/* Duration indicator */}
            {width > 60 && (
                <div className="absolute top-1 right-1 px-1 py-0.5 bg-black/70 rounded text-[8px] font-mono text-white">
                    {formatDuration(segment.durationSec)}
                </div>
            )}

            {/* Lock indicator */}
            {segment.locked && (
                <div className="absolute top-1 left-1 text-yellow-400">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                </div>
            )}

            {/* Trim mode indicator (when selected) */}
            {isSelected && trimMode !== 'normal' && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1 py-0.5 bg-orange-600/90 rounded text-[8px] font-bold text-white uppercase">
                    {trimMode}
                </div>
            )}
        </div>
    );
}

/**
 * Format duration in seconds to MM:SS
 */
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
};

