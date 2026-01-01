/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OTIO-Inspired Types
 * 
 * Based on OpenTimelineIO data model:
 * - RationalTime: Frame-accurate time representation
 * - TimeRange: Start + duration (not start + end)
 * - Clip: Media segment with source range
 * - Gap: Empty space on timeline
 * - Track: Sequence of clips and gaps
 * - Timeline: Container for tracks
 * 
 * Reference: https://opentimelineio.readthedocs.io/
 */

// === RATIONAL TIME ===
// Represents time as frames at a specific rate
export interface RationalTime {
    value: number;   // Frame count or seconds * rate
    rate: number;    // Frames per second (24, 25, 30)
}

export function createRationalTime(seconds: number, fps: number): RationalTime {
    return {
        value: Math.round(seconds * fps),
        rate: fps
    };
}

export function rationalTimeToSeconds(rt: RationalTime): number {
    return rt.value / rt.rate;
}

export function addRationalTimes(a: RationalTime, b: RationalTime): RationalTime {
    if (a.rate !== b.rate) {
        throw new Error('Cannot add RationalTimes with different rates');
    }
    return { value: a.value + b.value, rate: a.rate };
}

// === TIME RANGE ===
// A span of time (start + duration, not start + end)
export interface TimeRange {
    start: RationalTime;
    duration: RationalTime;
}

export function createTimeRange(
    startSec: number,
    durationSec: number,
    fps: number
): TimeRange {
    return {
        start: createRationalTime(startSec, fps),
        duration: createRationalTime(durationSec, fps)
    };
}

export function timeRangeEndTime(range: TimeRange): RationalTime {
    return addRationalTimes(range.start, range.duration);
}

export function timeRangeToSeconds(range: TimeRange): { start: number; duration: number; end: number } {
    const start = rationalTimeToSeconds(range.start);
    const duration = rationalTimeToSeconds(range.duration);
    return { start, duration, end: start + duration };
}

// === MEDIA REFERENCE ===
export type MediaReferenceType = 'external' | 'generated' | 'missing';

export interface MediaReference {
    type: MediaReferenceType;
    url?: string;           // For external/generated media
    mediaId?: string;       // For IndexedDB stored media
    availableRange: TimeRange;  // Total duration of source media
    metadata?: {
        width?: number;
        height?: number;
        codec?: string;
        hasAudio?: boolean;
    };
}

// === CLIP ===
// A segment of media with specific in/out points
export interface OTIOClip {
    id: string;
    name: string;
    mediaReference: MediaReference;
    sourceRange: TimeRange;    // Portion of media used (in source time)
    // Timeline position is calculated based on position in track
    metadata?: {
        aiGenerated?: boolean;
        prompt?: string;
        dogmaId?: string;
        linkGroupId?: string;    // For linked V1+A1 segments
        thumbnailUrl?: string;
    };
}

// === GAP ===
// Empty space on timeline
export interface OTIOGap {
    id: string;
    duration: RationalTime;
}

// === TRACK ITEM ===
export type TrackItem =
    | { type: 'clip'; item: OTIOClip }
    | { type: 'gap'; item: OTIOGap };

// === TRACK ===
export type TrackKind = 'video' | 'audio';

export interface OTIOTrack {
    id: string;
    kind: TrackKind;
    name: string;              // "V1", "A1", etc.
    children: TrackItem[];    // Ordered sequence
    muted: boolean;
    locked: boolean;
    visible: boolean;
}

// Calculate track duration
export function getTrackDuration(track: OTIOTrack, fps: number): RationalTime {
    let totalFrames = 0;
    for (const child of track.children) {
        if (child.type === 'clip') {
            totalFrames += child.item.sourceRange.duration.value;
        } else {
            totalFrames += child.item.duration.value;
        }
    }
    return { value: totalFrames, rate: fps };
}

// Get item at timeline position
export function getItemAtTime(
    track: OTIOTrack,
    timeSec: number,
    fps: number
): { item: TrackItem; startSec: number; endSec: number } | null {
    let currentSec = 0;

    for (const child of track.children) {
        const duration = child.type === 'clip'
            ? rationalTimeToSeconds(child.item.sourceRange.duration)
            : rationalTimeToSeconds(child.item.duration);

        const endSec = currentSec + duration;

        if (timeSec >= currentSec && timeSec < endSec) {
            return { item: child, startSec: currentSec, endSec };
        }

        currentSec = endSec;
    }

    return null;
}

// === TIMELINE ===
export interface OTIOTimeline {
    id: string;
    name: string;
    fps: 24 | 25 | 30;
    globalStartTime: RationalTime;
    tracks: OTIOTrack[];
    metadata?: {
        aspect?: '16:9' | '9:16' | '1:1';
        createdAt?: string;
        updatedAt?: string;
    };
}

// Get timeline duration (longest track)
export function getTimelineDuration(timeline: OTIOTimeline): RationalTime {
    let maxFrames = 0;
    for (const track of timeline.tracks) {
        const trackDuration = getTrackDuration(track, timeline.fps);
        if (trackDuration.value > maxFrames) {
            maxFrames = trackDuration.value;
        }
    }
    return { value: maxFrames, rate: timeline.fps };
}
