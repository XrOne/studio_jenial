/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelineClip - Individual clip on the timeline track
 * Displays segment thumbnail, label, and status
 */
'use client';

import * as React from 'react';
import { SegmentWithUI } from '../types/timeline';

interface TimelineClipProps {
    segment: SegmentWithUI;
    isSelected: boolean;
    pixelsPerSecond: number;
    trackHeight: number;
    onClick: () => void;
    onDoubleClick?: () => void;
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
 * Shows thumbnail, label, and duration.
 */
export default function TimelineClip({
    segment,
    isSelected,
    pixelsPerSecond,
    trackHeight,
    onClick,
    onDoubleClick,
}: TimelineClipProps) {
    const width = segment.durationSec * pixelsPerSecond;
    const left = segment.inSec * pixelsPerSecond;

    // Get thumbnail from active revision if available
    const thumbnailUrl = segment.activeRevision?.outputAsset?.url;
    const status = segment.activeRevision?.status || 'draft';

    return (
        <div
            className={`
        absolute rounded-md overflow-hidden cursor-pointer
        transition-all duration-150 ease-out
        bg-gray-800 border
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
        >
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
