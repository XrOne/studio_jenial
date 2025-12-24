/**
 * Preview Storage Utility (MVP)
 * 
 * Mocks Supabase persistence using LocalStorage for Vercel Preview environment.
 * Allows testing full app flow without backend database connection.
 */

import { Project, ProjectState, Dogma, UserProfile } from '../types';

const STORAGE_KEYS = {
    PROJECTS: 'preview_projects',
    DOGMAS: 'preview_dogmas',
    PROFILE: 'preview_profile'
};

const isPreview = import.meta.env.VITE_VERCEL_ENV === 'preview' || window.location.hostname.includes('vercel.app');

// === PROJECTS ===

export const localProjects = {
    list: (userId: string): Project[] => {
        if (!isPreview) return [];
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
            return all.filter((p: Project) => p.user_id === userId);
        } catch { return []; }
    },

    create: (userId: string, title: string): Project => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            user_id: userId,
            title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            content_json: null
        };
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        all.unshift(newProject);
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(all));
        return newProject;
    },

    save: (projectId: string, state: ProjectState): void => {
        const all: Project[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        const index = all.findIndex(p => p.id === projectId);
        if (index >= 0) {
            all[index] = {
                ...all[index],
                content_json: state,
                updated_at: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(all));
            console.log('[PreviewStorage] Project saved:', projectId);
        }
    },

    load: (projectId: string): Project | null => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        return all.find((p: Project) => p.id === projectId) || null;
    },

    delete: (projectId: string): void => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        const filtered = all.filter((p: Project) => p.id !== projectId);
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(filtered));
    }
};

// === PROFILES ===

export const localProfile = {
    get: (userId: string): UserProfile | null => {
        try {
            const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) || '{}');
            return profiles[userId] || { id: userId, email: 'preview@user.com' }; // Mock default
        } catch { return null; }
    },

    update: (userId: string, updates: Partial<UserProfile>): void => {
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) || '{}');
        profiles[userId] = { ...profiles[userId], ...updates, id: userId };
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profiles));
    }
};

// === DOGMAS ===

export const localDogmas = {
    list: (userId: string): Dogma[] => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOGMAS) || '[]');
            // Filter by user or public? For preview, just return all + defaults
            return all;
        } catch { return []; }
    },

    save: (dogma: Dogma): void => {
        const all: Dogma[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOGMAS) || '[]');
        const index = all.findIndex(d => d.id === dogma.id);
        if (index >= 0) {
            all[index] = dogma;
        } else {
            all.push(dogma);
        }
        localStorage.setItem(STORAGE_KEYS.DOGMAS, JSON.stringify(all));
    },

    delete: (dogmaId: string): void => {
        const all: Dogma[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.DOGMAS) || '[]');
        const filtered = all.filter(d => d.id !== dogmaId);
        localStorage.setItem(STORAGE_KEYS.DOGMAS, JSON.stringify(filtered));
    }
};
