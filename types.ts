
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum AppState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export enum AppStage {
  PROMPTING = 'Prompt Conception',
  EDITING = 'AI Image Editor',
  RESULT = 'Video Result',
}

export enum VeoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO = 'veo-3.1-generate-preview',
  VEO_3 = 'veo-3.0-generate-preview',
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Text to Video',
  FRAMES_TO_VIDEO = 'Frames to Video',
  REFERENCES_TO_VIDEO = 'References to Video',
  EXTEND_VIDEO = 'Extend Video',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface PromptSequence {
  mainPrompt: string;
  extensionPrompts: string[];
}

export interface SequenceProgress {
  current: number;
  total: number;
}

// A serializable representation of an image for storing Dogmas in localStorage.
export interface DogmaImage {
  name: string;
  type: string;
  base64: string;
}

export interface Dogma {
  id: string;
  title: string;
  text: string;
  referenceImages: DogmaImage[];
}

export interface CharacterImage extends DogmaImage {
  label: string; // e.g., 'Front View', 'Profile View'
}

export interface Character {
  id: string;
  name: string;
  description: string;
  images: CharacterImage[];
  voiceName?: string;
  sampleText?: string;
}


export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame?: ImageFile | null;
  endFrame?: ImageFile | null;
  referenceImages?: ImageFile[];
  styleImage?: ImageFile | null;
  inputVideo?: VideoFile | null;
  inputVideoObject?: any | null; // Changed from Video to any
  isLooping?: boolean;
}

export interface RegeneratePromptParams {
  index: number;
  promptToRevise: string;
  instruction: string;
  visualContextBase64?: string;
}

export interface ReviseFollowingPromptsParams {
  dogma: Dogma | null;
  promptBefore: string | undefined;
  editedPrompt: string;
  promptsToRevise: string[];
}

export interface SavedShot {
  id: string;
  title?: string;
  prompt: string;
  thumbnail: string; // base64 string
  createdAt: string; // ISO date string
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
}

export interface Keyframe {
  timestamp: string;
  description: string;
  imageBase64: string;
}

export interface Storyboard {
  prompt: string;
  keyframes: Keyframe[];
}

export interface SequenceVideoData {
  video: any; // Changed from Video to any
  blob: Blob;
  url: string;
  thumbnail: string; // base64
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: ImageFile | null;
}

export interface ComplianceResult {
  score: number;
  critique: string;
  revisedPrompt?: string;
}
