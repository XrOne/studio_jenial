/**
 * useShotLibrary Hook - Local-First with IndexedDB
 * Stores shots in local IndexedDB for full quality, offline-first workflow
 * Cloud sync is optional (Supabase) - disabled by default for cost reasons
 */

import { useState, useEffect, useCallback } from 'react';
import { SavedShot } from '../types';
import { LocalShot } from '../types/project';
import { saveShot as saveToIndexedDB, getShotsByProject, deleteShot as deleteFromIndexedDB, blobToBase64, base64ToBlob, db } from '../services/localMediaDB';

const ACTIVE_PROJECT_KEY = 'studio_jenial_active_project';

export function useShotLibrary() {
  const [shots, setShots] = useState<SavedShot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isCloudEnabled = false; // Cloud disabled - local-first

  // Get current project ID
  const getProjectId = (): string => {
    return localStorage.getItem(ACTIVE_PROJECT_KEY) || 'default-project';
  };

  // Load shots from IndexedDB on mount
  useEffect(() => {
    loadShots();
  }, []);

  const loadShots = async () => {
    setIsLoading(true);
    try {
      const projectId = getProjectId();
      const localShots = await getShotsByProject(projectId);

      // Convert LocalShot to SavedShot format
      const savedShots: SavedShot[] = await Promise.all(localShots.map(async (shot) => ({
        id: shot.id,
        prompt: shot.prompt,
        createdAt: shot.createdAt,
        model: shot.model,
        // Convert blob to base64 for display
        thumbnail: shot.thumbnailBlob ? await blobToBase64(shot.thumbnailBlob) : undefined,
        videoUrl: shot.videoUrl || (shot.videoBlob ? URL.createObjectURL(shot.videoBlob) : undefined),
      })));

      setShots(savedShots);
      console.log(`[useShotLibrary] Loaded ${savedShots.length} shots from IndexedDB`);
    } catch (error) {
      console.error('[useShotLibrary] Failed to load shots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addShot = useCallback(async (newShot: SavedShot) => {
    const projectId = getProjectId();

    // Create LocalShot for IndexedDB
    const localShot: LocalShot = {
      id: newShot.id,
      projectId,
      prompt: newShot.prompt,
      createdAt: newShot.createdAt,
      model: newShot.model,
      segmentIndex: undefined,
      // Convert base64 thumbnail to blob for efficient storage
      thumbnailBlob: newShot.thumbnail ? base64ToBlob(newShot.thumbnail, 'image/png') : undefined,
      videoUrl: newShot.videoUrl,
    };

    try {
      await saveToIndexedDB(localShot);
      setShots(prev => [newShot, ...prev]);
      console.log(`[useShotLibrary] Saved shot: ${newShot.id}`);
    } catch (error) {
      console.error('[useShotLibrary] Failed to save shot:', error);
      throw error;
    }
  }, []);

  const deleteShot = useCallback(async (shotId: string) => {
    try {
      await deleteFromIndexedDB(shotId);
      setShots(prev => prev.filter(s => s.id !== shotId));
      console.log(`[useShotLibrary] Deleted shot: ${shotId}`);
    } catch (error) {
      console.error('[useShotLibrary] Failed to delete shot:', error);
    }
  }, []);

  const updateShotTitle = useCallback(async (shotId: string, newTitle: string) => {
    try {
      // Get existing shot
      const existing = await db.shots.get(shotId);
      if (existing) {
        // Update in IndexedDB
        await db.shots.update(shotId, { ...existing });
        setShots(prev => prev.map(s => s.id === shotId ? { ...s, title: newTitle } : s));
      }
    } catch (error) {
      console.error('[useShotLibrary] Failed to update shot title:', error);
    }
  }, []);

  // Save video blob to shot (for full quality storage)
  const saveVideoToShot = useCallback(async (shotId: string, videoBlob: Blob) => {
    try {
      const existing = await db.shots.get(shotId);
      if (existing) {
        existing.videoBlob = videoBlob;
        await db.shots.put(existing);
        console.log(`[useShotLibrary] Saved video blob for shot: ${shotId} (${(videoBlob.size / 1024 / 1024).toFixed(2)}MB)`);
      }
    } catch (error) {
      console.error('[useShotLibrary] Failed to save video:', error);
    }
  }, []);

  return {
    shots,
    addShot,
    deleteShot,
    updateShotTitle,
    saveVideoToShot,
    isCloudEnabled,
    isLoading,
    refreshShots: loadShots,
  };
}
