
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
  // === NEW: Scoping context ===
  id: string;                         // Unique sequence ID
  projectId?: string;                 // Optional project grouping
  dogmaId: string | null;             // The dogma bound to this sequence at creation

  // === Existing fields ===
  mainPrompt: string;
  extensionPrompts: string[];

  // === NEW: Dirty tracking ===
  status: PromptSequenceStatus;
  dirtyExtensions: number[];          // Indices of extensions needing regeneration

  // === NEW: Audit timestamps ===
  createdAt: string;
  rootModifiedAt?: string;            // Track when root was last modified
}

export enum PromptSequenceStatus {
  CLEAN = 'clean',
  ROOT_MODIFIED = 'root_modified',     // Root changed, extensions invalid
  EXTENSIONS_DIRTY = 'extensions_dirty', // Some extensions need regen
  GENERATING = 'generating',
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
  provider?: VideoProvider;
  vertexConfig?: VertexConfig;
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

// --- VERTEX AI EXTENSIONS ---
export enum VideoProvider {
  GEMINI = 'Gemini API',
  VERTEX = 'Vertex AI',
}

export interface VertexConfig {
  projectId: string;
  location: string;
  accessToken: string;
}

// === NANO BANANA PRO: Storyboard & Shot Variants ===

export type StoryboardPreviewOwner = 'root' | 'extension' | 'character';

export interface StoryboardPreview {
  id: string;
  owner: StoryboardPreviewOwner;
  segmentIndex?: number;       // 0=root, 1..n=extensions (if owner != 'character')
  characterId?: string;
  baseImage?: ImageFile;       // Source image (assistantImage / lastFrame / char image)
  previewImage: ImageFile;     // Validated preview (Nano output)
  previewPrompt: string;       // Exact prompt corresponding to previewImage
  cameraNotes?: string;        // e.g., "35mm, plan taille, 3/4 face, caméra basse"
  movementNotes?: string;      // e.g., "dolly-in lent, pan léger"
  createdAt: string;
  updatedAt: string;
}

export interface ShotVariant {
  label: string;               // "Plan moyen", "Plan épaule", etc.
  previewImage: ImageFile;
  cameraNotes: string;
  deltaInstruction: string;    // Instruction used to obtain this variant
}

// Standard shot labels for "Couverture de plans"
export const STANDARD_SHOT_LIST = [
  'Plan d\'ensemble',
  'Demi-ensemble',
  'Plan moyen',
  'Plan genoux',
  'Plan américain',
  'Plan taille',
  'Plan poitrine',
  'Plan épaule',
  'Gros plan',
  'Très gros plan',
  'Plongée',
  'Contre-plongée',
] as const;

/**
 * Payload returned by AIEditorModal.onApply callback
 * Used for Nano Banana Pro prompt alignment
 */
export interface NanoApplyPayload {
  target: 'root' | 'extension' | 'character';
  segmentIndex: number | null;  // null = character edit, 0 = root, 1..N = extensions
  previewPrompt: string;
  previewImage: ImageFile;
  cameraNotes?: string;
  movementNotes?: string;
}

/**
 * Context for opening Nano editor from any entry point
 * Centralized in Studio.tsx via openNanoEditor()
 */
export interface NanoEditorContext {
  segmentIndex: number | null;
  target: 'root' | 'extension' | 'character';
  dogma: Dogma | null;
  baseImage?: ImageFile;
  initialPrompt?: string;
}
