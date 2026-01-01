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
    // Prefer frame fields as source of truth, fallback to seconds
    const durationFrames = segment.durationFrames ?? Math.round((segment.outSec - segment.inSec) * fps);

    const sourceStartFrame = segment.sourceStartFrame ?? Math.round((segment.sourceInSec ?? 0) * fps);
    const sourceDurationFrames = segment.sourceDurationFrames ?? durationFrames; // Default to clip duration if unknown

    const availableDurationFrames = segment.sourceDurationFrames ?? sourceDurationFrames;

    return {
        id: segment.id,
        name: segment.label || `Clip ${segment.id.slice(0, 4)}`,
        mediaReference: {
            type: segment.mediaKind === 'rush' ? 'external' : 'generated',
            url: segment.mediaSrc || segment.activeRevision?.videoUrl,
            mediaId: segment.mediaId,
            availableRange: {
                start: { value: 0, rate: fps },
                duration: { value: availableDurationFrames, rate: fps }
            }
        },
        sourceRange: {
            start: { value: sourceStartFrame, rate: fps },
            duration: { value: durationFrames, rate: fps }
        },
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
    timelineInSec: number, // Still used for initial placement from UI drag
    projectId: string
): SegmentWithUI {
    const fps = clip.sourceRange.start.rate;
    const timelineInFrame = Math.round(timelineInSec * fps);

    // Frame values
    const durationFrames = clip.sourceRange.duration.value;
    const sourceStartFrame = clip.sourceRange.start.value;
    const sourceDurationFrames = clip.mediaReference.availableRange.duration.value;

    // Derived Seconds (for UI compatibility)
    const durationSec = durationFrames / fps;
    const sourceStartSec = sourceStartFrame / fps;
    const sourceDurationSec = sourceDurationFrames / fps;

    return {
        id: clip.id,
        projectId,
        trackId,
        order: 0,

        // Frames (Source of Truth)
        startFrame: timelineInFrame,
        durationFrames: durationFrames,
        sourceStartFrame: sourceStartFrame,
        sourceDurationFrames: sourceDurationFrames,

        // Seconds (Computed/Legacy)
        inSec: timelineInSec,
        outSec: timelineInSec + durationSec,
        durationSec: durationSec,
        sourceInSec: sourceStartSec,
        sourceOutSec: sourceStartSec + durationSec,
        sourceDurationSec: sourceDurationSec,

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
 * Uses frame arithmetic to eliminate float drift and phantom gaps.
 */
export function buildTrackItems(
    segments: SegmentWithUI[],
    fps: number = DEFAULT_FPS
): TrackItem[] {
    // Sort segments by time
    const sorted = [...segments].sort((a, b) => a.inSec - b.inSec);
    const items: TrackItem[] = [];

    let currentFrame = 0;

    for (const seg of sorted) {
        // Determine segment start frame (prefer explicit field, fallback to calc)
        const segStartFrame = seg.startFrame ?? Math.round(seg.inSec * fps);
        const segDurationFrames = seg.durationFrames ?? Math.round((seg.outSec - seg.inSec) * fps);

        // Gap calculation in frames
        const gapFrames = segStartFrame - currentFrame;

        // Tolerance: gap must be > 1 frame to be real
        // gap <= 1 frame is considered contiguous (snap error elimination)
        if (gapFrames > 1) {
            items.push({
                type: 'gap',
                item: {
                    id: `gap-${currentFrame}`,
                    duration: { value: gapFrames, rate: fps }
                }
            });
            // Advance currentFrame by gap
            currentFrame += gapFrames;
            // Note: currentFrame should now equal segStartFrame strictly, 
            // but if we swallowed a 1-frame gap, we effectively shift the segment back by 1 frame?
            // User requested: "gap <= 1 => 0 (segments contigus)".
            // This implies we snap the segment to currentFrame visually?
            // Or just don't render gap?
            // If we simply don't render gap, the segment renders at its original position (absolute),
            // leaving 1px hole.
            // But if we use this for layout, we are implying relative layout.
            // HorizontalTimeline uses absolute positioning based on loop logic.
            // The prompt says: "buildTrackItems() : gaps calculés en frames avec tolérance 1 frame".
            // If we return items, HorizontalTimeline iterates them.
            // If we omit gap, the next item follows immediately.
        }

        // Add segment (Clip)
        items.push({
            type: 'clip',
            item: segmentToOTIOClip(seg, fps)
        });

        // Advance
        currentFrame += segDurationFrames;
    }

    return items;
}
