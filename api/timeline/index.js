import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router({ mergeParams: true }); // Merge params to get :id from parent if mounted specifically

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * GET /api/projects/:id/segments
 * 
 * Fetches all segments for a project with their revisions.
 */
router.get('/segments', async (req, res, next) => {
    try {
        const { id } = req.params; // Project ID

        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        const { data: segments, error } = await scopedClient
            .from('segments')
            .select(`
                *,
                segment_revisions (*)
            `)
            .eq('project_id', id)
            .order('order_index', { ascending: true });

        if (error) throw error;

        res.json({ success: true, segments: segments || [] });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/projects/:id/build-timeline
 * 
 * Converts a PromptSequence (client-side draft) into persisted Segments.
 * Idempotent-ish: Clears existing segments for this project (or a specific revision branch) 
 * and recreates them. For now, strict overwrite as per "Build Timeline" semantics.
 */
router.post('/build-timeline', async (req, res, next) => {
    try {
        const { id } = req.params; // Project ID
        const { promptSequence, segments } = req.body; // Expecting standardized segments array

        if (!segments || !Array.isArray(segments)) {
            const err = new Error('Invalid payload: segments array required');
            err.statusCode = 400;
            throw err;
        }

        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        // Transaction logic (Supabase doesn't support generic transactions via REST easily without RPC, 
        // using basic sequential ops for Beta).

        // 1. Delete existing segments for project (Clean slate for now)
        // In production, we might want to "archive" them instead.
        const { error: delErr } = await scopedClient
            .from('segments')
            .delete()
            .eq('project_id', id);

        if (delErr) throw delErr;

        // 2. Prepare bulk insert
        const rows = segments.map((seg, idx) => ({
            project_id: id,
            order_index: idx + 1,
            label: seg.label || `Segment ${idx + 1}`,
            duration_sec: seg.duration || 3.0,
            in_sec: 0,
            out_sec: seg.duration || 3.0,
            locked: false
            // active_revision_id is null initially
        }));

        // 3. Insert new segments
        const { data: insertedSegments, error: insErr } = await scopedClient
            .from('segments')
            .insert(rows)
            .select();

        if (insErr) throw insErr;

        // 4. (Optional) Create initial revisions if we have asset URLs/Prompts passed in?
        // If promptSequence is passed, we could create 'draft' revisions.
        // Leaving this for "Phase D" enhancement. For now, we just lay down the slots.

        res.json({ success: true, segments: insertedSegments });
    } catch (err) {
        next(err);
    }
});

/**
 * PATCH /api/projects/:id/timeline/ops
 * 
 * Batch operations: SPLIT, TRIM, REORDER
 * Payload: { op: 'reorder', orders: { id: index } }
 * Payload: { op: 'trim', id: '..', updates: { in: 0, out: 5 } }
 */
router.patch('/timeline/ops', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { op, payload } = req.body;

        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        if (op === 'reorder') {
            // payload.orders = { [segmentId]: newIndex }
            const updates = Object.entries(payload.orders).map(([segId, newIdx]) => {
                return scopedClient.from('segments').update({ order_index: newIdx }).eq('id', segId);
            });
            await Promise.all(updates); // Warning: Not transactional
            res.json({ success: true });

        } else if (op === 'trim') {
            // payload = { id, in, out, duration }
            const { data, error } = await scopedClient
                .from('segments')
                .update({
                    in_sec: payload.in,
                    out_sec: payload.out,
                    duration_sec: payload.duration
                })
                .eq('id', payload.id)
                .select()
                .single();
            if (error) throw error;
            res.json(data);
        } else {
            res.status(400).json({ error: 'Unknown Op' });
        }
    } catch (err) {
        next(err);
    }
});

export default router;
