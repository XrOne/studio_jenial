/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OTIO Utilities
 * 
 * Helper functions for OTIO adapter and track layout calculation.
 */

import { SegmentWithUI, DEFAULT_FPS } from '../types/timeline';
import {
    OTIOClip, OTIOGap, TrackItem,
    createTimeRange, timeRangeToSeconds, rationalTimeToSeconds, createRationalTime
} from '../types/otio';

// === ADAPTER: Segment ↔ Clip ===

export function segmentToOTIOClip(segment: SegmentWithUI, fps: number = DEFAULT_FPS): OTIOClip {
    const durationSec = segment.outSec - segment.inSec;
    const sourceInSec = segment.sourceInSec ?? 0;
    const sourceDurationSec = segment.sourceDurationSec ?? durationSec;

    return {
        id: segment.id,
        name: segment.label || `Clip ${segment.id.slice(0, 4)}`,
        mediaReference: {
            type: segment.mediaKind === 'rush' ? 'external' : 'generated',
            url: segment.mediaSrc || segment.activeRevision?.videoUrl,
            mediaId: segment.mediaId,
            availableRange: createTimeRange(0, sourceDurationSec, fps)
        },
        sourceRange: createTimeRange(sourceInSec, durationSec, fps),
        metadata: {
            aiGenerated: segment.mediaKind !== 'rush',
            linkGroupId: segment.linkGroupId,
            thumbnailUrl: segment.activeRevision?.thumbnailUrl
        }
    };
}

export function otioClipToSegment(
    clip: OTIOClip,
    trackId: string,
    timelineInSec: number,
    projectId: string
): SegmentWithUI {
    const { start, duration } = timeRangeToSeconds(clip.sourceRange);
    const availableDuration = rationalTimeToSeconds(clip.mediaReference.availableRange.duration);

    return {
        id: clip.id,
        projectId,
        trackId,
        order: 0,
        inSec: timelineInSec,
        outSec: timelineInSec + duration,
        durationSec: duration,
        sourceInSec: start,
        sourceOutSec: start + duration,
        sourceDurationSec: availableDuration,
        mediaSrc: clip.mediaReference.url,
        mediaId: clip.mediaReference.mediaId,
        mediaKind: clip.mediaReference.type === 'external' ? 'rush' : 'generated',
        linkGroupId: clip.metadata?.linkGroupId,
        label: clip.name,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uiState: 'idle'
    };
}

// === TRACK LAYOUT ===

/**
 * Builds a sequence of Clips and Gaps from a list of Segments.
 * Assumes segments are for a single track.
 */
export function buildTrackItems(
    segments: SegmentWithUI[],
    fps: number = DEFAULT_FPS
): TrackItem[] {
    // Sort segments by time
    const sorted = [...segments].sort((a, b) => a.inSec - b.inSec);
    const items: TrackItem[] = [];
    let currentTime = 0;

    for (const seg of sorted) {
        // Check for gap before segment (tolerance 0.01s)
        if (seg.inSec > currentTime + 0.01) {
            const gapDuration = seg.inSec - currentTime;
            items.push({
                type: 'gap',
                item: {
                    id: `gap-${Math.round(currentTime * 100)}`,
                    duration: createRationalTime(gapDuration, fps)
                }
            });
        }

        // Add segment (Clip)
        items.push({
            type: 'clip',
            item: segmentToOTIOClip(seg, fps)
        });

        currentTime = seg.outSec;
    }

    return items;
}
