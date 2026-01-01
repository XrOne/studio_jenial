/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Timeline Adapter
 * Provides bidirectional mapping between our SegmentWithUI format
 * and @xzdarcy/react-timeline-editor's TimelineRow format
 */

import { TimelineRow, TimelineAction } from '@xzdarcy/react-timeline-editor';
import { SegmentWithUI, Track } from '../types/timeline';

// === EXTENDED ACTION DATA ===
// Custom data we attach to each TimelineAction
export interface SegmentActionData {
    // Source media info
    sourceInSec?: number;
    sourceOutSec?: number;
    sourceDurationSec?: number;
    mediaSrc?: string;
    mediaId?: string;

    // Linked clips
    linkGroupId?: string;

    // Visual info
    label?: string;
    thumbnailUrl?: string;

    // Generation state
    activeRevisionId?: string;
    status?: 'idle' | 'generating' | 'ready' | 'error';

    // Original segment reference
    originalSegment?: SegmentWithUI;
}

// === SEGMENT → ACTION ===
/**
 * Convert a SegmentWithUI to a TimelineAction for the library
 */
export function segmentToAction(segment: SegmentWithUI): TimelineAction {
    return {
        id: segment.id,
        start: segment.inSec,
        end: segment.outSec,
        effectId: segment.trackId, // 'v1', 'a1', etc.
        // Preserve all segment data for round-trip
        data: {
            sourceInSec: segment.sourceInSec,
            sourceOutSec: segment.sourceOutSec,
            sourceDurationSec: segment.sourceDurationSec,
            mediaSrc: segment.mediaSrc,
            mediaId: segment.mediaId,
            linkGroupId: segment.linkGroupId,
            label: segment.label,
            thumbnailUrl: segment.activeRevision?.thumbnailUrl,
            activeRevisionId: segment.activeRevisionId,
            originalSegment: segment,
        } as SegmentActionData,
    };
}

// === ACTION → SEGMENT ===
/**
 * Convert a TimelineAction back to SegmentWithUI
 */
export function actionToSegment(
    action: TimelineAction,
    trackId: string
): SegmentWithUI {
    const data = action.data as SegmentActionData | undefined;
    const original = data?.originalSegment;

    // If we have an original segment, merge with updates
    if (original) {
        return {
            ...original,
            inSec: action.start,
            outSec: action.end,
            durationSec: action.end - action.start,
            trackId,
        };
    }

    // Create new segment from action
    return {
        id: action.id,
        projectId: 'local',
        trackId,
        order: 0,
        inSec: action.start,
        outSec: action.end,
        durationSec: action.end - action.start,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiState: 'idle',
        sourceInSec: data?.sourceInSec,
        sourceOutSec: data?.sourceOutSec,
        sourceDurationSec: data?.sourceDurationSec,
        mediaSrc: data?.mediaSrc,
        mediaId: data?.mediaId,
        linkGroupId: data?.linkGroupId,
        label: data?.label,
        activeRevisionId: data?.activeRevisionId,
    };
}

// === SEGMENTS → ROWS ===
/**
 * Convert SegmentWithUI[] to TimelineRow[] grouped by track
 */
export function segmentsToRows(
    segments: SegmentWithUI[],
    tracks: Track[]
): TimelineRow[] {
    return tracks.map(track => ({
        id: track.id,
        actions: segments
            .filter(seg => seg.trackId === track.id)
            .map(segmentToAction)
            .sort((a, b) => a.start - b.start),
    }));
}

// === ROWS → SEGMENTS ===
/**
 * Convert TimelineRow[] back to SegmentWithUI[]
 */
export function rowsToSegments(rows: TimelineRow[]): SegmentWithUI[] {
    const segments: SegmentWithUI[] = [];

    for (const row of rows) {
        const trackId = row.id;
        for (const action of row.actions) {
            segments.push(actionToSegment(action, trackId));
        }
    }

    // Re-sort by timeline position
    return segments.sort((a, b) => a.inSec - b.inSec);
}

// === COMPUTE MAX DURATION ===
/**
 * Calculate total timeline duration from segments
 */
export function computeTimelineDuration(segments: SegmentWithUI[]): number {
    if (segments.length === 0) return 30; // Default 30s
    return Math.max(...segments.map(s => s.outSec), 30);
}

// === SCALE CONFIG ===
export const DEFAULT_SCALE = 60; // pixels per second
export const MIN_SCALE = 10;
export const MAX_SCALE = 200;
