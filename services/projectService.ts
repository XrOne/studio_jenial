import { supabase } from './supabaseClient';
import { Project, ProjectState, UserProfile } from '../types';

export const ProjectService = {
    // === PROJECTS ===

    async listProjects(userId: string): Promise<Project[]> {
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
        if (!supabase) throw new Error('Supabase client not initialized');

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) throw error;
    },

    // === PROFILES ===

    async getProfile(userId: string): Promise<UserProfile | null> {
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
