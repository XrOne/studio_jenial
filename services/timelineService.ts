/**
 * Timeline Service
 * 
 * Service layer for timeline API operations.
 * Handles communication between frontend and backend timeline endpoints.
 */
import { supabase } from './supabaseClient';
import { Segment, SegmentWithUI, SegmentRevision } from '../types/timeline';

const API_BASE = '/api/projects';

/**
 * Transform DB row to frontend Segment type
 */
const transformSegment = (row: any): Segment => ({
    id: row.id,
    projectId: row.project_id,
    order: row.order_index ?? row.order ?? 0,
    inSec: parseFloat(row.in_sec) || 0,
    outSec: parseFloat(row.out_sec) || 0,
    durationSec: parseFloat(row.duration_sec) || (parseFloat(row.out_sec) - parseFloat(row.in_sec)) || 0,
    activeRevisionId: row.active_revision_id,
    label: row.label,
    locked: row.locked ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisions: row.segment_revisions?.map(transformRevision) || []
});

/**
 * Transform DB row to frontend SegmentRevision type
 */
const transformRevision = (row: any): SegmentRevision => ({
    id: row.id,
    segmentId: row.segment_id,
    parentRevisionId: row.parent_revision_id,
    provider: row.provider || 'veo',
    status: row.status || 'draft',
    promptJson: row.prompt_json || { rootPrompt: '' },
    baseAssetId: row.base_asset_id,
    outputAssetId: row.output_asset_id,
    metricsJson: row.metrics_json,
    errorJson: row.error_json,
    createdAt: row.created_at
});

/**
 * Add UI state to segment for frontend use
 */
const toSegmentWithUI = (segment: Segment): SegmentWithUI => ({
    ...segment,
    uiState: segment.locked ? 'locked' : 'idle'
});

export const TimelineService = {
    /**
     * Build Timeline (POST)
     * Converts promptSequence segments into persisted DB segments.
     * Overwrites existing segments for the project.
     */
    async buildTimeline(projectId: string, segments: Partial<Segment>[]): Promise<Segment[]> {
        const res = await fetch(`${API_BASE}/${projectId}/build-timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segments })
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to build timeline');
        }

        const data = await res.json();
        return (data.segments || []).map(transformSegment);
    },

    /**
     * Reorder Segments (PATCH)
     * Update order_index for multiple segments at once.
     */
    async reorderSegments(projectId: string, orders: Record<string, number>): Promise<void> {
        const res = await fetch(`${API_BASE}/${projectId}/timeline/ops`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'reorder', payload: { orders } })
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to reorder segments');
        }
    },

    /**
     * Trim Segment (PATCH)
     * Update in/out points for a segment.
     */
    async trimSegment(
        projectId: string,
        segmentId: string,
        inSec: number,
        outSec: number
    ): Promise<Segment> {
        const res = await fetch(`${API_BASE}/${projectId}/timeline/ops`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                op: 'trim',
                payload: {
                    id: segmentId,
                    in: inSec,
                    out: outSec,
                    duration: outSec - inSec
                }
            })
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to trim segment');
        }

        const data = await res.json();
        return transformSegment(data);
    },

    /**
     * Load Segments (GET via Supabase)
     * Fetches all segments for a project with their revisions.
     */
    async loadSegments(projectId: string): Promise<SegmentWithUI[]> {
        if (!supabase) {
            console.warn('[TimelineService] Supabase not initialized, returning empty');
            return [];
        }

        const { data, error } = await supabase
            .from('segments')
            .select(`
                *,
                segment_revisions (*)
            `)
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });

        if (error) {
            console.error('[TimelineService] Load error:', error);
            throw error;
        }

        return (data || []).map(transformSegment).map(toSegmentWithUI);
    },

    /**
     * Delete Segment
     * Removes a segment from the database.
     */
    async deleteSegment(segmentId: string): Promise<void> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { error } = await supabase
            .from('segments')
            .delete()
            .eq('id', segmentId);

        if (error) throw error;
    },

    /**
     * Duplicate Segment
     * Creates a copy of a segment with a new ID.
     */
    async duplicateSegment(segment: Segment): Promise<Segment> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { data, error } = await supabase
            .from('segments')
            .insert({
                project_id: segment.projectId,
                order_index: segment.order + 1,
                label: `${segment.label || 'Segment'} (Copy)`,
                duration_sec: segment.durationSec,
                in_sec: segment.inSec,
                out_sec: segment.outSec,
                locked: false
            })
            .select()
            .single();

        if (error) throw error;
        return transformSegment(data);
    },

    /**
     * Update Segment Lock Status
     */
    async setSegmentLock(segmentId: string, locked: boolean): Promise<void> {
        if (!supabase) throw new Error('Supabase not initialized');

        const { error } = await supabase
            .from('segments')
            .update({ locked })
            .eq('id', segmentId);

        if (error) throw error;
    }
};

export default TimelineService;
