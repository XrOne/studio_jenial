/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * useSequenceBins - Hook for managing sequence bins
 * 
 * Features:
 * - CRUD operations for bins and slots
 * - localStorage persistence
 * - Video generation queue management
 * - Auto-fill slots when videos are generated
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  SequenceBin,
  SequenceSlot,
  SlotVideo,
  CreateSequenceBinInput,
  SlotStatus,
  calculateBinStats,
  GenerationQueueItem,
} from '../types/bins';
import { ImageFile, Dogma } from '../types';

const STORAGE_KEY = 'studio-jenial-sequence-bins';
const QUEUE_KEY = 'studio-jenial-generation-queue';

/**
 * Load bins from localStorage
 */
const loadBins = (): SequenceBin[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[useSequenceBins] Failed to load bins:', e);
  }
  return [];
};

/**
 * Save bins to localStorage
 */
const saveBins = (bins: SequenceBin[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bins));
  } catch (e) {
    console.error('[useSequenceBins] Failed to save bins:', e);
  }
};

/**
 * Load generation queue from localStorage
 */
const loadQueue = (): GenerationQueueItem[] => {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[useSequenceBins] Failed to load queue:', e);
  }
  return [];
};

/**
 * Save generation queue to localStorage
 */
const saveQueue = (queue: GenerationQueueItem[]): void => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[useSequenceBins] Failed to save queue:', e);
  }
};

export interface UseSequenceBinsReturn {
  // State
  bins: SequenceBin[];
  generationQueue: GenerationQueueItem[];
  isProcessingQueue: boolean;
  
  // Bin operations
  createBin: (input: CreateSequenceBinInput) => SequenceBin;
  updateBin: (binId: string, updates: Partial<SequenceBin>) => void;
  deleteBin: (binId: string) => void;
  renameBin: (binId: string, newName: string) => void;
  toggleBinExpanded: (binId: string) => void;
  
  // Slot operations
  updateSlot: (binId: string, slotId: string, updates: Partial<SequenceSlot>) => void;
  fillSlotWithVideo: (binId: string, slotId: string, video: SlotVideo) => void;
  setSlotStatus: (binId: string, slotId: string, status: SlotStatus, errorMessage?: string) => void;
  regenerateSlot: (binId: string, slotId: string) => void;
  
  // Queue operations
  addToQueue: (binId: string, slotId: string, priority?: number) => void;
  addAllPendingToQueue: (binId: string) => void;
  removeFromQueue: (binId: string, slotId: string) => void;
  clearQueue: () => void;
  getNextInQueue: () => GenerationQueueItem | null;
  
  // Helpers
  getBinById: (binId: string) => SequenceBin | undefined;
  getSlotById: (binId: string, slotId: string) => SequenceSlot | undefined;
  getBinStats: (binId: string) => { totalDuration: number; readyCount: number; totalCount: number };
}

export const useSequenceBins = (): UseSequenceBinsReturn => {
  const [bins, setBins] = useState<SequenceBin[]>(() => loadBins());
  const [generationQueue, setGenerationQueue] = useState<GenerationQueueItem[]>(() => loadQueue());
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Persist bins to localStorage on change
  useEffect(() => {
    saveBins(bins);
  }, [bins]);

  // Persist queue to localStorage on change
  useEffect(() => {
    saveQueue(generationQueue);
  }, [generationQueue]);

  // ===========================
  // BIN OPERATIONS
  // ===========================

  const createBin = useCallback((input: CreateSequenceBinInput): SequenceBin => {
    const now = new Date().toISOString();
    const binId = `bin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create slots from input shots
    const slots: SequenceSlot[] = input.shots.map((shot, index) => ({
      id: `slot_${binId}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      order: index + 1,
      shotType: shot.shotType,
      duration: shot.duration,
      cameraMovement: shot.cameraMovement,
      prompt: shot.prompt,
      keyframe: shot.keyframe,
      status: 'pending' as SlotStatus,
      createdAt: now,
      updatedAt: now,
    }));

    const totalDuration = slots.reduce((sum, s) => sum + s.duration, 0);

    const newBin: SequenceBin = {
      id: binId,
      name: input.name,
      description: input.description,
      dogmaId: input.dogma?.id,
      dogmaSnapshot: input.dogma || undefined,
      rootPrompt: input.rootPrompt,
      slots,
      totalDuration,
      readyCount: 0,
      createdAt: now,
      updatedAt: now,
      isExpanded: true, // Start expanded
    };

    setBins(prev => [...prev, newBin]);
    console.log(`[useSequenceBins] Created bin "${input.name}" with ${slots.length} slots`);
    
    return newBin;
  }, []);

  const updateBin = useCallback((binId: string, updates: Partial<SequenceBin>) => {
    setBins(prev => prev.map(bin => {
      if (bin.id !== binId) return bin;
      const updated = { ...bin, ...updates, updatedAt: new Date().toISOString() };
      // Recalculate stats if slots changed
      if (updates.slots) {
        const stats = calculateBinStats(updated);
        updated.totalDuration = stats.totalDuration;
        updated.readyCount = stats.readyCount;
      }
      return updated;
    }));
  }, []);

  const deleteBin = useCallback((binId: string) => {
    setBins(prev => prev.filter(bin => bin.id !== binId));
    // Also remove any queued items for this bin
    setGenerationQueue(prev => prev.filter(item => item.binId !== binId));
    console.log(`[useSequenceBins] Deleted bin ${binId}`);
  }, []);

  const renameBin = useCallback((binId: string, newName: string) => {
    updateBin(binId, { name: newName });
  }, [updateBin]);

  const toggleBinExpanded = useCallback((binId: string) => {
    setBins(prev => prev.map(bin => 
      bin.id === binId ? { ...bin, isExpanded: !bin.isExpanded } : bin
    ));
  }, []);

  // ===========================
  // SLOT OPERATIONS
  // ===========================

  const updateSlot = useCallback((binId: string, slotId: string, updates: Partial<SequenceSlot>) => {
    setBins(prev => prev.map(bin => {
      if (bin.id !== binId) return bin;
      
      const updatedSlots = bin.slots.map(slot => 
        slot.id === slotId 
          ? { ...slot, ...updates, updatedAt: new Date().toISOString() }
          : slot
      );
      
      const updatedBin = { ...bin, slots: updatedSlots, updatedAt: new Date().toISOString() };
      const stats = calculateBinStats(updatedBin);
      updatedBin.totalDuration = stats.totalDuration;
      updatedBin.readyCount = stats.readyCount;
      
      return updatedBin;
    }));
  }, []);

  const fillSlotWithVideo = useCallback((binId: string, slotId: string, video: SlotVideo) => {
    console.log(`[useSequenceBins] Filling slot ${slotId} in bin ${binId} with video`);
    updateSlot(binId, slotId, {
      status: 'ready',
      video,
      errorMessage: undefined,
    });
    
    // Remove from queue if present
    setGenerationQueue(prev => prev.filter(
      item => !(item.binId === binId && item.slotId === slotId)
    ));
  }, [updateSlot]);

  const setSlotStatus = useCallback((
    binId: string, 
    slotId: string, 
    status: SlotStatus, 
    errorMessage?: string
  ) => {
    updateSlot(binId, slotId, { status, errorMessage });
  }, [updateSlot]);

  const regenerateSlot = useCallback((binId: string, slotId: string) => {
    // Reset slot to pending and clear video
    updateSlot(binId, slotId, {
      status: 'pending',
      video: undefined,
      errorMessage: undefined,
    });
  }, [updateSlot]);

  // ===========================
  // QUEUE OPERATIONS
  // ===========================

  const addToQueue = useCallback((binId: string, slotId: string, priority: number = 10) => {
    // Check if already in queue
    const exists = generationQueue.some(
      item => item.binId === binId && item.slotId === slotId
    );
    
    if (exists) {
      console.log(`[useSequenceBins] Slot ${slotId} already in queue`);
      return;
    }

    const queueItem: GenerationQueueItem = {
      binId,
      slotId,
      priority,
      addedAt: new Date().toISOString(),
    };

    setGenerationQueue(prev => [...prev, queueItem].sort((a, b) => a.priority - b.priority));
    console.log(`[useSequenceBins] Added slot ${slotId} to queue with priority ${priority}`);
  }, [generationQueue]);

  const addAllPendingToQueue = useCallback((binId: string) => {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return;

    const pendingSlots = bin.slots.filter(slot => slot.status === 'pending');
    pendingSlots.forEach((slot, index) => {
      addToQueue(binId, slot.id, index + 1); // Priority by order
    });

    console.log(`[useSequenceBins] Added ${pendingSlots.length} pending slots to queue`);
  }, [bins, addToQueue]);

  const removeFromQueue = useCallback((binId: string, slotId: string) => {
    setGenerationQueue(prev => prev.filter(
      item => !(item.binId === binId && item.slotId === slotId)
    ));
  }, []);

  const clearQueue = useCallback(() => {
    setGenerationQueue([]);
    console.log('[useSequenceBins] Queue cleared');
  }, []);

  const getNextInQueue = useCallback((): GenerationQueueItem | null => {
    return generationQueue.length > 0 ? generationQueue[0] : null;
  }, [generationQueue]);

  // ===========================
  // HELPERS
  // ===========================

  const getBinById = useCallback((binId: string): SequenceBin | undefined => {
    return bins.find(bin => bin.id === binId);
  }, [bins]);

  const getSlotById = useCallback((binId: string, slotId: string): SequenceSlot | undefined => {
    const bin = bins.find(b => b.id === binId);
    return bin?.slots.find(slot => slot.id === slotId);
  }, [bins]);

  const getBinStats = useCallback((binId: string) => {
    const bin = bins.find(b => b.id === binId);
    if (!bin) return { totalDuration: 0, readyCount: 0, totalCount: 0 };
    
    const stats = calculateBinStats(bin);
    return { ...stats, totalCount: bin.slots.length };
  }, [bins]);

  return {
    // State
    bins,
    generationQueue,
    isProcessingQueue,
    
    // Bin operations
    createBin,
    updateBin,
    deleteBin,
    renameBin,
    toggleBinExpanded,
    
    // Slot operations
    updateSlot,
    fillSlotWithVideo,
    setSlotStatus,
    regenerateSlot,
    
    // Queue operations
    addToQueue,
    addAllPendingToQueue,
    removeFromQueue,
    clearQueue,
    getNextInQueue,
    
    // Helpers
    getBinById,
    getSlotById,
    getBinStats,
  };
};

export default useSequenceBins;
