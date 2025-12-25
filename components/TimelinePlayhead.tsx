/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelinePlayhead - Vertical playhead indicator
 * Shows current playback position
 */
'use client';

import * as React from 'react';

interface TimelinePlayheadProps {
    positionSec: number;
    pixelsPerSecond: number;
    height: number;
    onDrag?: (newPositionSec: number) => void;
}

/**
 * TimelinePlayhead
 * 
 * Red vertical line indicating current playback position.
 * Can be dragged to seek.
 */
export default function TimelinePlayhead({
    positionSec,
    pixelsPerSecond,
    height,
    onDrag,
}: TimelinePlayheadProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const playheadRef = React.useRef<HTMLDivElement>(null);

    const positionPx = positionSec * pixelsPerSecond;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!onDrag) return;
        e.preventDefault();
        setIsDragging(true);
    };

    React.useEffect(() => {
        if (!isDragging || !onDrag) return;

        const handleMouseMove = (e: MouseEvent) => {
            const container = playheadRef.current?.parentElement;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const scrollLeft = container.scrollLeft || 0;
            const x = e.clientX - rect.left + scrollLeft;
            const newSec = Math.max(0, x / pixelsPerSecond);
            onDrag(newSec);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, pixelsPerSecond, onDrag]);

    return (
        <div
            ref={playheadRef}
            className="absolute top-0 z-50 pointer-events-auto cursor-ew-resize group"
            style={{
                left: `${positionPx}px`,
                height: `${height}px`,
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Playhead head (triangle) */}
            <div
                className="absolute -top-0 -left-[5.5px] w-[11px] h-[12px] bg-red-500"
                style={{
                    clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                }}
            />

            {/* Playhead line */}
            <div
                className="w-px bg-red-500 h-full shadow-[0_0_4px_rgba(239,68,68,0.5)]"
            />

            {/* Hover indicator */}
            {isDragging && (
                <div className="absolute top-3 left-2 px-1.5 py-0.5 bg-red-500 rounded text-[9px] text-white font-mono whitespace-nowrap">
                    {formatTimecode(positionSec)}
                </div>
            )}
        </div>
    );
}

/**
 * Format seconds to MM:SS:FF (frames at 24fps)
 */
const formatTimecode = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};
