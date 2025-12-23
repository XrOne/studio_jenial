import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * POST /api/segments
 * Create a new segment in a project
 */
router.post('/', async (req, res) => {
    try {
        const { project_id, order, label, in_sec, out_sec } = req.body;

        // RLS Context
        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        // Calculate default out_sec if not provided
        const defaultOutSec = out_sec || (in_sec || 0) + 5;

        const { data, error } = await scopedClient
            .from('segments')
            .insert([{
                project_id,
                order_index: order || 0,
                label,
                in_sec: in_sec || 0,
                out_sec: defaultOutSec
            }])
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[Segments] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/segments/:id
 * Update segment (trim, lock, label)
 */
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // { in_sec, out_sec, duration_sec, locked, label }

        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        const { data, error } = await scopedClient
            .from('segments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[Segments] Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/segments/:id/revisions
 * Create a new revision (e.g. from Nano Edit or Veo Gen)
 */
router.post('/:id/revisions', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            provider,
            prompt_json,
            base_asset_id,
            output_asset_id,
            parent_revision_id,
            status
        } = req.body;

        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        // 1. Insert Revision
        const { data: revision, error: revErr } = await scopedClient
            .from('segment_revisions')
            .insert([{
                segment_id: id,
                provider: provider || 'veo',
                prompt_json: prompt_json || { rootPrompt: '' },
                base_asset_id,
                output_asset_id,
                parent_revision_id,
                status: status || 'draft',
            }])
            .select()
            .single();

        if (revErr) throw revErr;

        // 2. Set as Active Revision (Auto-switch?)
        // Usually yes, when creating a new revision via UI, we want to see it.
        const { error: segErr } = await scopedClient
            .from('segments')
            .update({ active_revision_id: revision.id })
            .eq('id', id);

        if (segErr) {
            console.warn('[Segments] Failed to set active revision', segErr);
            // Don't fail the request, just return revision
        }

        res.json(revision);

    } catch (err) {
        console.error('[Segments] Create Revision error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/segments/:id
 * Delete a segment (Cascade deletes revisions/keyframes per schema)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        const { error } = await scopedClient
            .from('segments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[Segments] Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
