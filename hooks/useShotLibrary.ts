
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useEffect, useCallback } from 'react';
import { SavedShot } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { defaultShots } from '../data/defaultShots';
import useLocalStorage from './useLocalStorage';

export function useShotLibrary() {
  // Fallback local state using existing hook
  const [localShots, setLocalShots] = useLocalStorage<SavedShot[]>('shot-library', defaultShots);
  
  // Real exposed state
  const [shots, setShots] = useState<SavedShot[]>(localShots);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudEnabled, setIsCloudEnabled] = useState(isSupabaseConfigured());

  // Sync initial load
  useEffect(() => {
    if (isCloudEnabled && supabase) {
      fetchCloudShots();
    } else {
      setShots(localShots);
    }
  }, [isCloudEnabled]); // Depend on cloud status

  const fetchCloudShots = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shots')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
          // Map database columns to SavedShot type if snake_case is used in DB
          const mappedShots: SavedShot[] = data.map((item: any) => ({
              id: item.id,
              title: item.title,
              prompt: item.prompt,
              thumbnail: item.thumbnail,
              createdAt: item.created_at || item.createdAt, // Handle both cases
              model: item.model,
              aspectRatio: item.aspect_ratio || item.aspectRatio,
              resolution: item.resolution,
              mode: item.mode
          }));
          setShots(mappedShots);
      }
    } catch (error) {
      console.error("Error fetching shots from Supabase:", error);
      // Fallback to local if fetch fails? Or just show error.
      // For now, keep what we have or fallback
    } finally {
      setIsLoading(false);
    }
  };

  const addShot = async (newShot: SavedShot) => {
    if (isCloudEnabled && supabase) {
      // Optimistic update
      setShots(prev => [newShot, ...prev]);
      
      try {
        const { error } = await supabase.from('shots').insert([{
            id: newShot.id,
            title: newShot.title,
            prompt: newShot.prompt,
            thumbnail: newShot.thumbnail,
            created_at: newShot.createdAt,
            model: newShot.model,
            aspect_ratio: newShot.aspectRatio,
            resolution: newShot.resolution,
            mode: newShot.mode
        }]);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to save shot to cloud:", err);
        alert("Failed to sync shot to cloud, but it is saved locally for this session.");
        // In a real app, we might rollback the state here
      }
    } else {
      // Local Storage logic
      const updated = [newShot, ...localShots];
      setLocalShots(updated);
      setShots(updated);
    }
  };

  const deleteShot = async (shotId: string) => {
    if (isCloudEnabled && supabase) {
      // Optimistic update
      setShots(prev => prev.filter(s => s.id !== shotId));
      try {
        const { error } = await supabase.from('shots').delete().eq('id', shotId);
        if (error) throw error;
      } catch (err) {
         console.error("Failed to delete from cloud:", err);
      }
    } else {
      const updated = localShots.filter(s => s.id !== shotId);
      setLocalShots(updated);
      setShots(updated);
    }
  };

  const updateShotTitle = async (shotId: string, newTitle: string) => {
     if (isCloudEnabled && supabase) {
        setShots(prev => prev.map(s => s.id === shotId ? { ...s, title: newTitle } : s));
        try {
            const { error } = await supabase.from('shots').update({ title: newTitle }).eq('id', shotId);
            if (error) throw error;
        } catch (err) {
            console.error("Failed to update title in cloud:", err);
        }
     } else {
        const updated = localShots.map(s => s.id === shotId ? { ...s, title: newTitle } : s);
        setLocalShots(updated);
        setShots(updated);
     }
  };

  return {
    shots,
    addShot,
    deleteShot,
    updateShotTitle,
    isCloudEnabled,
    isLoading
  };
}
