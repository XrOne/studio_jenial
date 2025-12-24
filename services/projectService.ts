import { supabase } from './supabaseClient';
import { Project, ProjectState, UserProfile } from '../types';
import { localProjects, localProfile } from '../utils/previewStorage';

const isPreview = import.meta.env.VITE_VERCEL_ENV === 'preview' ||
    (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));

export const ProjectService = {
    // === PROJECTS ===

    async listProjects(userId: string): Promise<Project[]> {
        if (isPreview) {
            console.log('[ProjectService] Preview Mode: Listing local projects');
            return localProjects.list(userId);
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createProject(userId: string, title: string = 'Untitled Project'): Promise<Project> {
        if (isPreview) {
            console.log('[ProjectService] Preview Mode: Creating local project');
            return localProjects.create(userId, title);
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase
            .from('projects')
            .insert({
                user_id: userId,
                title,
                content_json: null // Start empty
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async saveProject(projectId: string, state: ProjectState): Promise<void> {
        if (isPreview) {
            console.log('[ProjectService] Preview Mode: Saving local project');
            localProjects.save(projectId, state);
            return;
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { error } = await supabase
            .from('projects')
            .update({
                content_json: state, // Save full JSON state
                updated_at: new Date().toISOString()
            })
            .eq('id', projectId);

        if (error) throw error;
    },

    async loadProject(projectId: string): Promise<Project> {
        if (isPreview) {
            const project = localProjects.load(projectId);
            if (!project) throw new Error('Project not found in preview storage');
            return project;
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error) throw error;
        return data;
    },

    async deleteProject(projectId: string): Promise<void> {
        if (isPreview) {
            localProjects.delete(projectId);
            return;
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) throw error;
    },

    // === PROFILES ===

    async getProfile(userId: string): Promise<UserProfile | null> {
        if (isPreview) {
            return localProfile.get(userId);
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = JSON object requested, multiple (or no) rows returned
            console.error('Error fetching profile:', error);
            return null;
        }
        return data;
    },

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
        if (isPreview) {
            localProfile.update(userId, updates);
            return;
        }

        if (!supabase) throw new Error('Supabase client not initialized');

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                ...updates,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    }
};
