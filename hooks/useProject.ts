/**
 * useProject Hook
 * Manages project state with auto-save to localStorage
 * Premiere Pro-style project management
 */

import { useState, useEffect, useCallback } from 'react';
import { Project, JenialProjectFile, LocalShot } from '../types/project';
import { getShotsByProject, blobToBase64 } from '../services/localMediaDB';

const PROJECTS_KEY = 'studio_jenial_projects';
const ACTIVE_PROJECT_KEY = 'studio_jenial_active_project';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

// === PROJECT STORAGE (localStorage) ===

function getProjects(): Project[] {
    try {
        const data = localStorage.getItem(PROJECTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveProjects(projects: Project[]): void {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function getActiveProjectId(): string | null {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

function setActiveProjectId(id: string | null): void {
    if (id) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
}

// === HOOK ===

export function useProject() {
    const [project, setProject] = useState<Project | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    // Load projects on mount
    useEffect(() => {
        const allProjects = getProjects();
        setProjects(allProjects);

        // Load active project
        const activeId = getActiveProjectId();
        if (activeId) {
            const active = allProjects.find(p => p.id === activeId);
            if (active) {
                setProject(active);
            }
        }
    }, []);

    // Auto-save every 30s
    useEffect(() => {
        if (!project || !isDirty) return;

        const timer = setInterval(() => {
            if (isDirty) {
                saveCurrentProject();
            }
        }, AUTOSAVE_INTERVAL);

        return () => clearInterval(timer);
    }, [project, isDirty]);

    // Save current project to localStorage
    const saveCurrentProject = useCallback(() => {
        if (!project) return;

        const updated: Project = {
            ...project,
            updatedAt: new Date().toISOString(),
        };

        const allProjects = getProjects();
        const index = allProjects.findIndex(p => p.id === project.id);

        if (index >= 0) {
            allProjects[index] = updated;
        } else {
            allProjects.push(updated);
        }

        saveProjects(allProjects);
        setProjects(allProjects);
        setProject(updated);
        setIsDirty(false);
        console.log('[useProject] Saved project:', updated.name);
    }, [project]);

    // Create new project
    const createProject = useCallback((name: string): Project => {
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fps: 24,
            aspectRatio: '16:9',
            resolution: '1080p',
            shotIds: [],
            trackIds: ['v1', 'a1'],
            playheadSec: 0,
            sequenceMode: 'plan-sequence',
        };

        const allProjects = [...getProjects(), newProject];
        saveProjects(allProjects);
        setProjects(allProjects);
        setProject(newProject);
        setActiveProjectId(newProject.id);
        setIsDirty(false);

        console.log('[useProject] Created project:', name);
        return newProject;
    }, []);

    // Open existing project
    const openProject = useCallback((id: string): boolean => {
        const allProjects = getProjects();
        const found = allProjects.find(p => p.id === id);

        if (found) {
            setProject(found);
            setActiveProjectId(id);
            setIsDirty(false);
            console.log('[useProject] Opened project:', found.name);
            return true;
        }
        return false;
    }, []);

    // Update project
    const updateProject = useCallback((updates: Partial<Project>) => {
        if (!project) return;

        setProject(prev => {
            if (!prev) return prev;
            return { ...prev, ...updates };
        });
        setIsDirty(true);
    }, [project]);

    // Add shot to project
    const addShotToProject = useCallback((shotId: string) => {
        if (!project) return;

        setProject(prev => {
            if (!prev) return prev;
            if (prev.shotIds.includes(shotId)) return prev;
            return { ...prev, shotIds: [...prev.shotIds, shotId] };
        });
        setIsDirty(true);
    }, [project]);

    // Export project as .jenial file
    const exportProject = useCallback(async (): Promise<void> => {
        if (!project) return;

        // Save first
        saveCurrentProject();

        // Get shots from IndexedDB
        const shots = await getShotsByProject(project.id);

        // Build export file
        const exportData: JenialProjectFile = {
            version: '1.0',
            project,
            shots: await Promise.all(shots.map(async (shot) => ({
                id: shot.id,
                prompt: shot.prompt,
                thumbnail: shot.thumbnailBlob ? await blobToBase64(shot.thumbnailBlob) : undefined,
                videoRef: shot.videoUrl || undefined,
            }))),
        };

        // Create blob and download
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}.jenial`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[useProject] Exported project:', project.name);
    }, [project, saveCurrentProject]);

    // Import project from .jenial file
    const importProject = useCallback(async (file: File): Promise<boolean> => {
        try {
            const text = await file.text();
            const data: JenialProjectFile = JSON.parse(text);

            if (data.version !== '1.0') {
                console.error('[useProject] Unsupported file version:', data.version);
                return false;
            }

            // Save project
            const importedProject: Project = {
                ...data.project,
                id: `proj-${Date.now()}`, // New ID to avoid conflicts
                updatedAt: new Date().toISOString(),
            };

            const allProjects = [...getProjects(), importedProject];
            saveProjects(allProjects);
            setProjects(allProjects);
            setProject(importedProject);
            setActiveProjectId(importedProject.id);

            console.log('[useProject] Imported project:', importedProject.name);
            return true;
        } catch (error) {
            console.error('[useProject] Import failed:', error);
            return false;
        }
    }, []);

    // Delete project
    const deleteProject = useCallback((id: string) => {
        const allProjects = getProjects().filter(p => p.id !== id);
        saveProjects(allProjects);
        setProjects(allProjects);

        if (project?.id === id) {
            setProject(null);
            setActiveProjectId(null);
        }
    }, [project]);

    return {
        project,
        projects,
        isDirty,
        createProject,
        openProject,
        updateProject,
        saveProject: saveCurrentProject,
        addShotToProject,
        exportProject,
        importProject,
        deleteProject,
    };
}
