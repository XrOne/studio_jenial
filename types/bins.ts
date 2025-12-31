/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Sequence Bins - Types for NLE-style media organization
 * 
 * Architecture:
 * - SequenceBin: A folder containing shots from a découpage session
 * - SequenceSlot: A single shot placeholder that can be empty or filled with generated video
 * - Integrates with BinManager for drag-drop to timeline
 */

import { ImageFile, Dogma } from '../types';

/**
 * Status of a sequence slot
 */
export type SlotStatus =
  | 'pending'      // Awaiting generation
  | 'generating'   // Currently being generated
  | 'ready'        // Video generated successfully
  | 'error';       // Generation failed

/**
 * Camera movement types (French/English)
 */
export const CAMERA_MOVEMENTS = [
  'Static (Fixe)',
  'Traveling Avant (Slow Push In)',
  'Traveling Arrière (Slow Pull Out)',
  'Panoramique Gauche (Pan Left)',
  'Panoramique Droite (Pan Right)',
  'Tilt Haut (Tilt Up)',
  'Tilt Bas (Tilt Down)',
  'Plan Drone (Drone Shot)',
  'Plan Épaule (Handheld shake)',
  'Steadycam (Smooth follow)',
  'Dolly Zoom (Vertigo Effect)',
  'Low Angle (Contre-plongée)',
  'High Angle (Plongée)',
] as const;

export type CameraMovement = typeof CAMERA_MOVEMENTS[number];

/**
 * Standard shot types for découpage
 */
export const STANDARD_SHOT_TYPES = [
  'Plan Large (Wide Shot)',
  'Plan Moyen (Medium Shot)',
  'Plan Américain (American Shot)',
  'Plan Rapproché (Close-Up)',
  'Gros Plan (Extreme Close-Up)',
  'Insert (Detail Shot)',
  'Plan Séquence (Long Take)',
  'Contre-Plongée (Low Angle)',
  'Plongée (High Angle)',
  'Plan Subjectif (POV)',
  'Plan Over-Shoulder (OTS)',
  'Two-Shot (Plan à Deux)',
] as const;

export type ShotType = typeof STANDARD_SHOT_TYPES[number];

/**
 * Generated video data attached to a slot
 */
export interface SlotVideo {
  id: string;
  url: string;                    // Object URL or blob URL
  blob?: Blob;                    // Raw video blob for export
  thumbnail?: string;             // Base64 thumbnail
  generatedAt: string;            // ISO timestamp
  duration?: number;              // Actual video duration in seconds
  veoUri?: string;                // Veo API URI for extensions
}

/**
 * A single slot in a sequence bin
 * Represents one shot from the découpage
 */
export interface SequenceSlot {
  id: string;
  order: number;                  // Position in sequence (1-based)
  shotType: ShotType | string;    // Type of shot (can be custom)
  duration: number;               // Planned duration in seconds
  cameraMovement?: CameraMovement | string;

  // Prompt & keyframe
  prompt: string;                 // Generation prompt
  keyframe?: ImageFile;           // Nano preview image

  // Generation state
  status: SlotStatus;
  video?: SlotVideo;              // Generated video (when ready)
  errorMessage?: string;          // Error details if status === 'error'

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * A sequence bin - folder containing shots from découpage
 */
export interface SequenceBin {
  id: string;
  name: string;                   // User-defined name: "Scène 3 - Confrontation"
  description?: string;           // Optional description

  // Source context
  dogmaId?: string;               // Dogma used for this sequence
  dogmaSnapshot?: Dogma;          // Frozen copy of dogma at creation time
  rootPrompt?: string;            // Original root prompt

  // Slots
  slots: SequenceSlot[];

  // Stats (computed)
  totalDuration: number;          // Sum of slot durations
  readyCount: number;             // Number of slots with status === 'ready'

  // Metadata
  createdAt: string;
  updatedAt: string;

  // UI state
  isExpanded?: boolean;           // Whether folder is expanded in BinManager
  color?: string;                 // Optional folder color for visual organization
}

/**
 * Input for creating a new sequence bin from découpage
 */
export interface CreateSequenceBinInput {
  name: string;
  description?: string;
  dogma?: Dogma | null;
  rootPrompt?: string;
  shots: Array<{
    shotType: string;
    prompt: string;
    duration: number;
    cameraMovement?: string;
    keyframe?: ImageFile;
  }>;
}

/**
 * Generation queue item for batch processing
 */
export interface GenerationQueueItem {
  binId: string;
  slotId: string;
  priority: number;               // Lower = higher priority
  addedAt: string;
}

/**
 * Props for SequenceBin folder component in BinManager
 */
export interface SequenceBinFolderProps {
  bin: SequenceBin;
  isSelected: boolean;
  onSelect: (binId: string) => void;
  onToggleExpand: (binId: string) => void;
  onSlotClick: (binId: string, slotId: string) => void;
  onSlotGenerate: (binId: string, slotId: string) => void;
  onSlotAddToTimeline: (binId: string, slotId: string) => void;
  onRename: (binId: string, newName: string) => void;
  onDelete: (binId: string) => void;
}

/**
 * Props for individual slot card
 */
export interface SlotCardProps {
  slot: SequenceSlot;
  binId: string;
  isSelected: boolean;
  onClick: () => void;
  onGenerate: () => void;
  onAddToTimeline: () => void;
  onOpenInSource: () => void;
}

/**
 * Event emitted when a video is generated and should fill a slot
 */
export interface SlotFillEvent {
  binId: string;
  slotId: string;
  video: SlotVideo;
}

/**
 * Helper: Calculate bin stats
 */
export const calculateBinStats = (bin: SequenceBin): { totalDuration: number; readyCount: number } => {
  const totalDuration = bin.slots.reduce((sum, slot) => sum + slot.duration, 0);
  const readyCount = bin.slots.filter(slot => slot.status === 'ready').length;
  return { totalDuration, readyCount };
};

/**
 * Helper: Generate timecode for a slot based on position
 */
export const getSlotTimecode = (bin: SequenceBin, slotIndex: number): string => {
  let cumulative = 0;
  for (let i = 0; i < slotIndex && i < bin.slots.length; i++) {
    cumulative += bin.slots[i].duration;
  }
  const mins = Math.floor(cumulative / 60);
  const secs = cumulative % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Helper: Check if all slots in a bin are ready
 */
export const isBinComplete = (bin: SequenceBin): boolean => {
  return bin.slots.every(slot => slot.status === 'ready');
};

/**
 * Helper: Get next pending slot for generation
 */
export const getNextPendingSlot = (bin: SequenceBin): SequenceSlot | null => {
  return bin.slots.find(slot => slot.status === 'pending') || null;
};
