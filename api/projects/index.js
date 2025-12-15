import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase Client (Service Role or Anon? For RLS, we pass user token or use Anon + Auth Header)
// In a real Vercel app, we forward the Authorization header to Supabase 
// so RLS works automatically if we key off auth.users
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/projects
 * List user's projects
 */
router.get('/', async (req, res) => {
    try {
        // Forward the user's JWT if present for RLS
        const token = req.headers.authorization?.replace('Bearer ', '');

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false });

        // Note: If using pure Service Role, we'd see all projects. 
        // If using Anon key, we rely on RLS. 
        // Supabase JS client doesn't automatically attach the bearer from req.headers unless configured.
        // For simplicity in this Node proxy, we might need 'supabase.auth.getUser(token)' 
        // or set the session on the client.
        // simpler strategy: backend uses Service Role (if secure) OR we assume 
        // the client calls Supabase directly for LIST.
        // But the User Plan asked for API Vercel.

        // To make RLS work with Node proxy:
        const { data: projects, error: err } = await supabase
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false })
            .auth(token); // Attempt to pass auth context if client supports it? 
        // Actually supabase-js v2: supabase.auth.setSession() or createClient with headers.

        // Alternative: Create a scoped client for this request
        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        const result = await scopedClient
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false });

        if (result.error) throw result.error;
        return res.json(result.data);

    } catch (err) {
        console.error('[Projects] List error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
    try {
        const { title, fps, aspect, owner_id } = req.body;

        // RLS Context
        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        const { data, error } = await scopedClient
            .from('projects')
            .insert([{ title, fps, aspect, owner_id }]) // owner_id must match auth.uid if RLS strict
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('[Projects] Create error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/projects/:id
 * Get FULL project state (Segments + Active Revisions + Assets)
 * This is the critical "Load Project" endpoint.
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const scopedClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.authorization } }
        });

        // 1. Fetch Project
        const { data: project, error: projErr } = await scopedClient
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (projErr) throw projErr;
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // 2. Fetch Segments (ordered) with Active Revision expanded?
        // Supabase can do deep joins:
        // segments ( *, active_revision:segment_revisions ( *,  output_image:assets(*), output_video:assets(*) ) )

        const { data: segments, error: segErr } = await scopedClient
            .from('segments')
            .select(`
        *,
        active_revision:segment_revisions (
          *,
          output_image:output_image_asset_id (*),
          output_video:output_video_asset_id (*)
        )
      `)
            .eq('project_id', id)
            .order('order_index', { ascending: true });

        if (segErr) throw segErr;

        // Return combined object
        res.json({
            project,
            segments
        });

    } catch (err) {
        console.error('[Projects] Get error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
