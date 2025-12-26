/**
 * useTimelineNavigation Hook
 * Handles keyboard shortcuts for timeline navigation and editing
 * 
 * Shortcuts:
 * - ←/→: Frame by frame navigation
 * - Shift+←/→: 1 second navigation
 * - X: Split segment at playhead
 * - Delete/Backspace: Remove selected segment
 * - Space: Play/Pause
 * - Home: Go to start
 * - End: Go to end
 */

import { useEffect, useCallback } from 'react';
import { SegmentWithUI } from '../types/timeline';

interface UseTimelineNavigationProps {
    playheadSec: number;
    fps: number;
    totalDuration: number;
    segments: SegmentWithUI[];
    selectedSegmentIds: string[];
    isSourceViewerOpen: boolean;
    onPlayheadChange: (sec: number) => void;
    onSplitSegment: (segmentId: string, atSec: number) => void;
    onDeleteSegment: (segmentId: string) => void;
    onPlayPause?: () => void;
}

export function useTimelineNavigation({
    playheadSec,
    fps,
    totalDuration,
    segments,
    selectedSegmentIds,
    isSourceViewerOpen,
    onPlayheadChange,
    onSplitSegment,
    onDeleteSegment,
    onPlayPause
}: UseTimelineNavigationProps) {

    const frameStep = 1 / fps;
    const secondStep = 1;

    // Find segment at playhead
    const getSegmentAtPlayhead = useCallback(() => {
        return segments.find(s =>
            playheadSec >= s.inSec && playheadSec < s.outSec
        );
    }, [segments, playheadSec]);

    // Handle keyboard events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle if typing in input or if source viewer is open
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (isSourceViewerOpen) return;

            switch (e.key) {
                // Frame navigation
                case 'ArrowLeft':
                    e.preventDefault();
                    const stepBack = e.shiftKey ? secondStep : frameStep;
                    onPlayheadChange(Math.max(0, playheadSec - stepBack));
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    const stepForward = e.shiftKey ? secondStep : frameStep;
                    onPlayheadChange(Math.min(totalDuration, playheadSec + stepForward));
                    break;

                // Split at playhead
                case 'x':
                case 'X':
                    e.preventDefault();
                    const segmentToSplit = getSegmentAtPlayhead();
                    if (segmentToSplit && !segmentToSplit.locked) {
                        // Don't split at the very start or end of a segment
                        if (playheadSec > segmentToSplit.inSec && playheadSec < segmentToSplit.outSec) {
                            onSplitSegment(segmentToSplit.id, playheadSec);
                        }
                    }
                    break;

                // Delete selected segment
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    if (selectedSegmentIds.length > 0) {
                        const segmentToDelete = segments.find(s => s.id === selectedSegmentIds[0]);
                        if (segmentToDelete && !segmentToDelete.locked) {
                            onDeleteSegment(selectedSegmentIds[0]);
                        }
                    }
                    break;

                // Play/Pause
                case ' ':
                    e.preventDefault();
                    if (onPlayPause) {
                        onPlayPause();
                    }
                    break;

                // Go to start
                case 'Home':
                    e.preventDefault();
                    onPlayheadChange(0);
                    break;

                // Go to end
                case 'End':
                    e.preventDefault();
                    onPlayheadChange(totalDuration);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        playheadSec, fps, totalDuration, segments, selectedSegmentIds,
        isSourceViewerOpen, frameStep, secondStep,
        onPlayheadChange, onSplitSegment, onDeleteSegment, onPlayPause,
        getSegmentAtPlayhead
    ]);

    return {
        getSegmentAtPlayhead,
        frameStep,
        secondStep
    };
}

export default useTimelineNavigation;
