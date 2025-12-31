/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './supabaseClient';
import { StoryboardPreview, Dogma } from '../types';

// ===================================
// TYPES
// ===================================

export interface UserProfile {
    id: string;
    user_identifier: string;
    last_seen_at: string;
}

export interface StudioSession {
    id: string;
    profile_id: string;
    name?: string;
    created_at: string;
    active_prompt_index: number;
    last_activity_at: string;

    // Data snapshots
    main_prompt: string;
    extension_prompts: string[];   // JSONB -> string[]
    dirty_extensions: number[];    // JSONB -> number[]
    dogma_id?: string;
    dogma_snapshot?: Dogma;
    sequence_video_data: Record<string, any>;
}

// ===================================
// PROFILE MANAGEMENT
// ===================================

/**
 * Get or create a user profile by identifier (pseudo/email)
 */
export async function getOrCreateProfile(identifier: string): Promise<UserProfile> {
    if (!supabase) throw new Error('Supabase not configured');

    // Try to find existing
    const { data: existing } = await supabase
        .from('studio_profiles')
        .select('*')
        .eq('user_identifier', identifier)
        .single();

    if (existing) {
        // Update last_seen
        await supabase
            .from('studio_profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', existing.id);
        return existing as UserProfile;
    }

    // Create new
    const { data: created, error } = await supabase
        .from('studio_profiles')
        .insert([{ user_identifier: identifier }])
        .select()
        .single();

    if (error) throw error;
    return created as UserProfile;
}

// ===================================
// SESSION MANAGEMENT
// ===================================

/**
 * Create a new empty session for a profile
 */
export async function createSession(profileId: string, name?: string): Promise<StudioSession> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
        .from('studio_sessions')
        .insert([{
            profile_id: profileId,
            name: name || `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            main_prompt: '',
            extension_prompts: [],
            dirty_extensions: [],
        }])
        .select()
        .single();

    if (error) throw error;
    return data as StudioSession;
}

/**
 * Update an existing session's state (Auto-save)
 */
export async function updateSession(
    sessionId: string,
    state: Partial<StudioSession>
): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
        .from('studio_sessions')
        .update({
            ...state,
            last_activity_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (error) console.error('Auto-save failed:', error);
}

/**
 * List history sessions for a profile
 */
export async function listSessions(profileId: string): Promise<StudioSession[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('studio_sessions')
        .select('*')
        .eq('profile_id', profileId)
        .order('last_activity_at', { ascending: false })
        .limit(20);

    if (error) throw error;
    return data as StudioSession[];
}

/**
 * Load full session data including storyboards
 */
export async function loadSession(sessionId: string): Promise<{
    session: StudioSession;
    storyboards: Record<number, StoryboardPreview>;
}> {
    if (!supabase) throw new Error('Supabase not configured');

    // 1. Get session
    const { data: session, error: sessionError } = await supabase
        .from('studio_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError) throw sessionError;

    // 2. Get storyboards
    const { data: previews, error: previewError } = await supabase
        .from('storyboard_previews')
        .select('*')
        .eq('session_id', sessionId);

    if (previewError) console.warn('Failed to load storyboards:', previewError);

    // Convert flat previews list to Record<segmentIndex, StoryboardPreview>
    const storyboards: Record<number, StoryboardPreview> = {};
    if (previews) {
        previews.forEach((p: any) => {
            // Only care about root/extension previews mapped by index
            if (p.segment_index !== null) {
                storyboards[p.segment_index] = {
                    id: p.id,
                    owner: p.owner,
                    segmentIndex: p.segment_index,
                    characterId: p.character_id,
                    baseImage: undefined, // Base image object not reconstructed, mostly URL needed
                    // Reconstruct minimal object for UI
                    previewImage: { base64: '', mimeType: 'image/jpeg' }, // Placeholder, real usage uses URL?
                    // Actually, we need to adapt UI to use URL if base64 missing
                    // For now let's store URLs in new fields if needed, or rely on re-fetching
                    previewPrompt: p.preview_prompt,
                    cameraNotes: p.camera_notes,
                    movementNotes: p.movement_notes,
                    createdAt: p.created_at,
                    updatedAt: p.updated_at,
                    // Custom fields for persistence
                    previewImageUrl: p.preview_image_url
                } as any;
            }
        });
    }

    return { session, storyboards };
}

// ===================================
// STORYBOARD PREVIEWS
// ===================================

/**
 * Save a storyboard preview linked to a session
 */
export async function saveStoryboardPreview(
    sessionId: string,
    preview: StoryboardPreview,
    previewUrl: string
): Promise<void> {
    if (!supabase) return;

    // Upsert logic: delete old for this segment index then insert new
    // (Simpler than complex upsert with composite keys)

    if (preview.segmentIndex !== undefined) {
        await supabase
            .from('storyboard_previews')
            .delete()
            .eq('session_id', sessionId)
            .eq('segment_index', preview.segmentIndex);
    }

    const { error } = await supabase.from('storyboard_previews').insert([{
        session_id: sessionId,
        owner: preview.owner,
        segment_index: preview.segmentIndex,
        character_id: preview.characterId,
        preview_image_url: previewUrl,
        preview_prompt: preview.previewPrompt,
        camera_notes: preview.cameraNotes,
        movement_notes: preview.movementNotes,
    }]);

    if (error) console.error('Failed to save storyboard:', error);
}
