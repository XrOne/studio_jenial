/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelineRuler - Time ruler with second markers
 * Displays timecode marks (00:00, 00:05, etc.)
 * Clickable to position playhead
 */
'use client';

import * as React from 'react';

interface TimelineRulerProps {
    durationSec: number;
    pixelsPerSecond: number;
    scrollLeft?: number;
    onClick?: (sec: number) => void;
}

/**
 * Format seconds to MM:SS
 */
const formatTimecode = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * TimelineRuler
 * 
 * Displays time markers along the top of the timeline.
 * Shows major marks every 5 seconds and minor marks every second.
 * Clicking on the ruler moves the playhead to that position.
 */
export default function TimelineRuler({
    durationSec,
    pixelsPerSecond,
    onClick,
}: TimelineRulerProps) {
    // Generate marks every 5 seconds
    const majorInterval = 5; // seconds
    const totalWidth = durationSec * pixelsPerSecond;
    const markCount = Math.ceil(durationSec / majorInterval) + 1;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newSec = Math.max(0, x / pixelsPerSecond);
        onClick(newSec);
    };

    return (
        <div
            className="h-7 bg-[#1a1a1a] border-b border-[#333] relative select-none overflow-hidden cursor-pointer"
            style={{ minWidth: `${totalWidth}px` }}
            onClick={handleClick}
        >
            {/* Background pattern for minor marks */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `repeating-linear-gradient(
                        to right,
                        transparent,
                        transparent ${pixelsPerSecond - 1}px,
                        #2a2a2a ${pixelsPerSecond - 1}px,
                        #2a2a2a ${pixelsPerSecond}px
                    )`,
                }}
            />

            {/* Major marks with labels */}
            {Array.from({ length: markCount }, (_, i) => {
                const seconds = i * majorInterval;
                const position = seconds * pixelsPerSecond;

                return (
                    <div
                        key={seconds}
                        className="absolute top-0 bottom-0 flex flex-col items-start pointer-events-none"
                        style={{ left: `${position}px` }}
                    >
                        {/* Vertical line */}
                        <div className="w-px h-full bg-[#444]" />

                        {/* Time label */}
                        <span
                            className="absolute bottom-1 text-[9px] font-mono text-gray-500 ml-1"
                            style={{ transform: 'translateX(-50%)' }}
                        >
                            {formatTimecode(seconds)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
