/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AIEditorModal from './components/AIEditorModal';
import ApiKeyDialog from './components/ApiKeyDialog';
import CharacterManager from './components/CharacterManager';
import DogmaManager from './components/DogmaManager';
import ErrorBoundary from './components/ErrorBoundary';
import {
  BookMarkedIcon,
  CurvedArrowDownIcon,
  FilmIcon,
  KeyIcon,
  SparklesIcon,
  UsersIcon,
  UploadCloudIcon,
} from './components/icons';
import LoadingIndicator from './components/LoadingIndicator';
import PromptEditorModal from './components/PromptEditorModal';
import PromptSequenceAssistant from './components/PromptSequenceAssistant';
import SequenceManager from './components/SequenceManager';
import ShotLibrary from './components/ShotLibrary';
import StoryboardPreviewModal from './components/StoryboardPreviewModal';

import { UserProfileModal } from './components/UserProfileModal'; // New
import { SessionHistoryModal } from './components/SessionHistoryModal'; // New
import { ExportDialog } from './components/ExportDialog';
import { BinManager } from './components/BinManager';
import { SourceViewer } from './components/SourceViewer';
import { TimelinePreview } from './components/TimelinePreview';
import VideoResult from './components/VideoResult';
import VisualContextViewer from './components/VisualContextViewer';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useTheme } from './contexts/ThemeContext';
import useLocalStorage from './hooks/useLocalStorage';
import { useShotLibrary } from './hooks/useShotLibrary';
import { useSequenceBins } from './hooks/useSequenceBins';
import { useSessionPersistence } from './hooks/useSessionPersistence'; // New // New Hook
import { CreateSequenceBinInput } from './types/bins';
import {
  generateVideo,
  reviseFollowingPrompts,
  fetchGeminiConfig,
  ApiError,
  uploadToGoogleFiles,
  getRuntimeApiKey, // New
  setRuntimeApiKey, // New
} from './services/geminiService';
import { generatePreview as generateNanoPreview } from './services/nanoService';
import { useAuth } from './contexts/AuthContext';
import {
  AppState,
  AppStage,
  AspectRatio,
  Character,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  NanoApplyPayload,
  NanoEditorContext,
  PromptSequence,
  PromptSequenceStatus,
  Resolution,
  SavedShot,
  SequenceProgress,
  SequenceVideoData,
  StoryboardPreview,
  VeoModel,
  VideoFile,
  VideoProvider,
} from './types';

import { TimelineState, SegmentWithUI, SegmentRevision, DEFAULT_FPS } from './types/timeline';
import VerticalTimelineStack from './components/VerticalTimelineStack';
import SegmentIAPanel from './components/SegmentIAPanel';
import { TimelineService } from './services/timelineService';
import HorizontalTimeline from './components/HorizontalTimeline';
import { usePlaybackEngine } from './services/playbackEngine';

// ===================================================================
// NEUTRAL DEFAULT: No hardcoded dogmas
// Dogma templates are available in data/dogmaTemplates.ts for optional import
// ===================================================================

// ===================================================================
// HELPER: Convert base64 to File with actual bytes
// Needed for AIEditorModal which uses URL.createObjectURL(file)
// ===================================================================
const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: mimeType });
};

const PromptConception: React.FC<{
  motionDescription: string | null;
  referenceImage: ImageFile | null;
  activeChatImage: ImageFile | null;
  mentionedCharacters: Character[];
  sequenceHistory?: SequenceVideoData[];
  // === NANO BANANA PRO: Thumbnail Retouche ===
  onOpenNanoEditor?: (segmentIndex: number, baseImage: ImageFile, initialPrompt: string) => void;
  promptSequence?: PromptSequence | null;
  storyboardByIndex?: Record<number, StoryboardPreview>;
  // === IMAGE-FIRST: Keyframe generation status ===
  isGeneratingKeyframes?: boolean;

  apiKey?: string | null; // P0.6: BYOK Strict
}> = ({
  motionDescription,
  referenceImage,
  activeChatImage,
  mentionedCharacters,
  sequenceHistory = [],
  onOpenNanoEditor,
  promptSequence,
  storyboardByIndex = {},
  isGeneratingKeyframes = false,

  apiKey,
}) => {
    const displayImage = activeChatImage || referenceImage;
    const hasContent =
      motionDescription || displayImage || mentionedCharacters.length > 0 || sequenceHistory.length > 0;

    // Determine the main title based on context
    const title = motionDescription
      ? 'Vecteur de Continuité'
      : displayImage
        ? 'Référence Active'
        : mentionedCharacters.length > 0
          ? 'Personnages Actifs'
          : 'Conception du Prompt';

    // Helper: Get preview badge status
    const getPreviewStatus = (segmentIndex: number): 'ok' | 'missing' | 'dirty' => {
      // Check if dirty (extension in dirtyExtensions)
      if (segmentIndex >= 1 && promptSequence?.dirtyExtensions?.includes(segmentIndex)) {
        return 'dirty';
      }
      // Check if storyboard preview exists
      if (storyboardByIndex[segmentIndex]) {
        return 'ok';
      }
      return 'missing';
    };

    // Helper: Get prompt for segment
    const getPromptForSegment = (segmentIndex: number): string => {
      if (!promptSequence) return '';
      if (segmentIndex === 0) return promptSequence.mainPrompt;
      return promptSequence.extensionPrompts[segmentIndex - 1] || '';
    };

    // Helper: Handle thumbnail click for Nano
    const handleThumbnailNano = (segmentIndex: number, thumbnail: string | undefined) => {
      if (!onOpenNanoEditor || !thumbnail) return;

      const baseImage: ImageFile = {
        file: base64ToFile(thumbnail, `thumbnail_${segmentIndex}.jpg`, 'image/jpeg'),
        base64: thumbnail,
      };
      const initialPrompt = getPromptForSegment(segmentIndex);
      onOpenNanoEditor(segmentIndex, baseImage, initialPrompt);
    };

    return (
      <div className="bg-[#1f1f1f] border border-gray-700 rounded-2xl h-full flex flex-col shadow-lg p-4 transition-all duration-500">
        <h3 className="text-lg font-semibold text-white mb-4 flex-shrink-0 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-indigo-400" />
          {title}
        </h3>
        <div className="flex-grow flex flex-col gap-4 overflow-y-auto">
          {!hasContent ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/50">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3 animate-pulse">
                <UsersIcon className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium">Context Radar Active</p>
              <p className="text-xs text-gray-600 mt-1 max-w-[200px]">
                Mention characters with "@", upload images in chat, or use Studio references to populate this panel.
              </p>
            </div>
          ) : (
            <>
              {/* Feature 2: Time Injection - Timeline Visualization with Nano Actions */}
              {sequenceHistory.length > 0 && (
                <div className="flex flex-col gap-2 bg-gray-800/50 p-2 rounded-xl border border-gray-700/50">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Sequence Flow</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900 text-indigo-300">{sequenceHistory.length} shots</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                    {sequenceHistory.map((data, idx) => {
                      const previewStatus = getPreviewStatus(idx);

                      return (
                        <div key={idx} className="flex-shrink-0 w-24 snap-start relative group">
                          <div className="aspect-video rounded-md overflow-hidden border border-gray-600 relative">
                            {data.thumbnail ? (
                              <img src={`data:image/jpeg;base64,${data.thumbnail}`} className="w-full h-full object-cover" alt={`Shot ${idx + 1}`} />
                            ) : (
                              <div className="w-full h-full bg-gray-900 flex items-center justify-center text-xs text-gray-500">Shot {idx + 1}</div>
                            )}

                            {/* Nano Hover Button */}
                            {onOpenNanoEditor && data.thumbnail && (
                              <button
                                onClick={() => handleThumbnailNano(idx, data.thumbnail)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              >
                                <span className="px-2 py-1 bg-orange-600 text-white text-[9px] font-semibold rounded-md shadow-lg flex items-center gap-1">
                                  <SparklesIcon className="w-3 h-3" />
                                  Nano
                                </span>
                              </button>
                            )}

                            {/* Preview Badge */}
                            <div className={`absolute top-1 right-1 px-1 py-0.5 text-[8px] font-bold rounded ${previewStatus === 'ok'
                              ? 'bg-green-600/80 text-green-100'
                              : previewStatus === 'dirty'
                                ? 'bg-orange-600/80 text-orange-100'
                                : 'bg-gray-600/80 text-gray-300'
                              }`}>
                              {previewStatus === 'ok' ? 'OK' : previewStatus === 'dirty' ? '⚠' : '—'}
                            </div>
                          </div>
                          <div className="text-[10px] text-center text-gray-500 mt-1">
                            {idx === 0 ? 'Root' : `Ext ${idx}`}
                          </div>
                          {idx === sequenceHistory.length - 1 && (
                            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Current Anchor" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === IMAGE-FIRST: Auto-Keyframes Panel === */}
              {(storyboardByIndex[0] || storyboardByIndex[1]) && (
                <div className="flex flex-col gap-2 bg-indigo-900/20 p-3 rounded-xl border border-indigo-600/30">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex justify-between items-center">
                    <span>🎬 Keyframes</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-800 text-indigo-200">Auto</span>
                  </div>
                  <div className="flex gap-3">
                    {/* Root Keyframe */}
                    {storyboardByIndex[0] && (
                      <div className="flex-1 relative group">
                        <div className="aspect-video rounded-lg overflow-hidden border-2 border-indigo-500/50 relative">
                          <img
                            src={`data:image/png;base64,${storyboardByIndex[0].previewImage.base64}`}
                            className="w-full h-full object-cover"
                            alt="Root Keyframe"
                          />
                          {/* Retoucher Button */}
                          {onOpenNanoEditor && (
                            <button
                              onClick={() => {
                                onOpenNanoEditor(0, storyboardByIndex[0].previewImage, getPromptForSegment(0));
                              }}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-semibold rounded-md shadow-lg flex items-center gap-1">
                                <SparklesIcon className="w-3 h-3" />
                                Retoucher (Nano)
                              </span>
                            </button>
                          )}
                          {/* Badge */}
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 text-[8px] font-bold rounded bg-green-600/80 text-white">
                            ROOT
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Extension 1 Keyframe */}
                    {storyboardByIndex[1] && (
                      <div className="flex-1 relative group">
                        <div className="aspect-video rounded-lg overflow-hidden border-2 border-purple-500/50 relative">
                          <img
                            src={`data:image/png;base64,${storyboardByIndex[1].previewImage.base64}`}
                            className="w-full h-full object-cover"
                            alt="Ext 1 Keyframe"
                          />
                          {/* Retoucher Button */}
                          {onOpenNanoEditor && (
                            <button
                              onClick={() => {
                                onOpenNanoEditor(1, storyboardByIndex[1].previewImage, getPromptForSegment(1));
                              }}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-semibold rounded-md shadow-lg flex items-center gap-1">
                                <SparklesIcon className="w-3 h-3" />
                                Retoucher (Nano)
                              </span>
                            </button>
                          )}
                          {/* Badge */}
                          <div className={`absolute top-1 right-1 px-1.5 py-0.5 text-[8px] font-bold rounded ${getPreviewStatus(1) === 'dirty' ? 'bg-orange-600/80' : 'bg-purple-600/80'
                            } text-white`}>
                            EXT 1 {getPreviewStatus(1) === 'dirty' && '⚠'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}



              {motionDescription && (
                <div className="bg-gray-800 p-4 rounded-xl border border-green-500/30 flex-shrink-0 shadow-md">
                  <div className="text-xs text-green-500 font-bold uppercase mb-1 tracking-wider">
                    Motion Vector
                  </div>
                  <p className="text-sm text-green-100 leading-relaxed">
                    {motionDescription}
                  </p>
                </div>
              )}
              {/* Always show reference/active image if it exists */}
              {displayImage && (
                <div className="relative group w-full aspect-video bg-black rounded-xl overflow-hidden flex-shrink-0 border border-gray-700 shadow-lg">
                  <img
                    src={URL.createObjectURL(displayImage.file)}
                    alt="Visual Context"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className="text-xs text-white font-medium">
                      {activeChatImage ? "Working Image" : "Visual Anchor"}
                    </span>
                  </div>
                </div>
              )}
              {/* Show mentioned characters in a separate section */}
              {mentionedCharacters.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
                    Cast on Set
                  </div>
                  {mentionedCharacters.map((char) => (
                    <div
                      key={char.id}
                      className="flex items-center gap-3 bg-gray-800/80 p-2 rounded-xl border border-gray-700 hover:border-indigo-500 transition-colors">
                      <div className="w-12 h-12 bg-black rounded-lg overflow-hidden flex-shrink-0">
                        {char.images.length > 0 && (
                          <img
                            src={`data:${char.images[0].type};base64,${char.images[0].base64}`}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-gray-200 truncate text-sm">
                          {char.name}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {char.voiceName || 'No voice assigned'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

const Studio: React.FC = () => {
  // === THEME ===
  const { theme, themeId } = useTheme();

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentStage, setCurrentStage] = useState<AppStage>(AppStage.PROMPTING);
  const [activeTab, setActiveTab] = useState<'conception' | 'editing' | 'export'>('conception');
  const [resetKey, setResetKey] = useState(0); // For forcing component remounts on reset
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  const [lastVideoObject, setLastVideoObject] = useState<any | null>(null); // Changed from Video to any
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);

  // BYOK Strict: API Key is memory-only (React State). No localStorage.
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false); // UI flag
  const [isCurrentVideoSaved, setIsCurrentVideoSaved] = useState(false);
  const [frameToEdit, setFrameToEdit] = useState<ImageFile | null>(null);

  const [promptSequence, setPromptSequence] = useState<PromptSequence | null>(
    null,
  );
  const [activePromptIndex, setActivePromptIndex] = useState<number | null>(
    null,
  );
  const [sequenceProgress, setSequenceProgress] =
    useState<SequenceProgress | null>(null);
  const [isRevisingSequence, setIsRevisingSequence] = useState<{
    fromIndex: number;
  } | null>(null);
  const [sequenceVideoData, setSequenceVideoData] = useState<
    Record<number, SequenceVideoData>
  >({});
  const [mainPromptConfig, setMainPromptConfig] =
    useState<GenerateVideoParams | null>(null);

  // === NANO BANANA PRO: 12 Vignettes Modal ===
  const [storyboardModalContext, setStoryboardModalContext] = useState<{
    segmentIndex: number;
    baseImage: ImageFile;
    currentPrompt: string;
    mode: 'single-select' | 'ordered-select';
  } | null>(null);
  const [originalVideoForExtension, setOriginalVideoForExtension] =
    useState<VideoFile | null>(null);
  // Explicit flag to distinguish external videos from internal Veo extensions
  const [isExternalVideoSource, setIsExternalVideoSource] = useState(false);
  const [assistantExtensionContext, setAssistantExtensionContext] =
    useState<ImageFile | null>(null);
  const [assistantImage, setAssistantImage] = useState<ImageFile | null>(null);
  const [assistantReferenceVideo, setAssistantReferenceVideo] =
    useState<VideoFile | null>(null);
  const [assistantMotionDescription, setAssistantMotionDescription] =
    useState<string | null>(null);
  const [characterToInject, setCharacterToInject] = useState<Character | null>(
    null,
  );
  const [mentionedCharacters, setMentionedCharacters] = useState<Character[]>(
    [],
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Dogma Library State ---
  const [dogmas, setDogmas] = useLocalStorage<Dogma[]>('dogma-library', []);
  const [activeDogmaId, setActiveDogmaId] = useLocalStorage<string | null>(
    'active-dogma-id',
    null,
  );
  const [isDogmaManagerOpen, setIsDogmaManagerOpen] = useState(false);
  // === NEW: Sequence-bound dogma (scoped to current PromptSequence) ===
  const [sequenceBoundDogma, setSequenceBoundDogma] = useState<Dogma | null>(null);
  const activeDogma = useMemo(
    () => dogmas.find((d) => d.id === activeDogmaId) ?? null,
    [dogmas, activeDogmaId],
  );

  /**
   * Sequence history must be numerically sorted by segment index to avoid unstable timeline order.
   * Object.values() does NOT guarantee order - this useMemo ensures root→ext1→ext2... always.
   */
  const sortedSequenceHistory = useMemo(() => {
    return Object.entries(sequenceVideoData)
      .map(([k, v]) => ({ idx: Number(k), v }))
      .filter(x => Number.isFinite(x.idx))
      .sort((a, b) => a.idx - b.idx)
      .map(x => x.v);
  }, [sequenceVideoData]);
  // --- Shot Library State (Now using smart hook) ---
  const {
    shots: savedShots,
    addShot: handleSaveShotToLibrary,
    deleteShot: handleDeleteShot,
    updateShotTitle: handleUpdateShotTitle,
    isCloudEnabled
  } = useShotLibrary();

  const [isShotLibraryOpen, setIsShotLibraryOpen] = useState(false);

  // --- Character Library State ---
  const [characters, setCharacters] = useLocalStorage<Character[]>(
    'character-library',
    [],
  );
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);
  // -------------------------

  const [editingPromptDetails, setEditingPromptDetails] = useState<{
    index: number;
    prompt: string;
    thumbnail?: string;
  } | null>(null);

  // === NANO BANANA PRO: Centralized editor context ===
  const [nanoEditorContext, setNanoEditorContext] = useState<NanoEditorContext | null>(null);
  const [storyboardByIndex, setStoryboardByIndex] = useState<Record<number, StoryboardPreview>>({});

  // === IMAGE-FIRST WORKFLOW: Auto-generate keyframes ===
  const [autoKeyframesEnabled, setAutoKeyframesEnabled] = useState(true);
  const [isGeneratingKeyframes, setIsGeneratingKeyframes] = useState(false);

  // === MODE SELECTION: Plan-séquence vs Découpage ===
  type SequenceMode = 'plan-sequence' | 'decoupage';
  const [sequenceMode, setSequenceMode] = useState<SequenceMode>('plan-sequence');
  // P0: Lift messages for persistence
  const [assistantMessages, setAssistantMessages] = useState<any[]>([]);

  // === SEQUENCE BINS (Découpage workflow) ===
  const {
    bins,
    createBin,
    fillSlotWithVideo,
    setSlotStatus,
    getBinById,
    getSlotById,
  } = useSequenceBins();


  // === SESSION PERSISTENCE ===
  const {
    profile,
    sessionId,
    isSaving,
    login,
    startNewSession,
    restoreSession,
    listHistory
  } = useSessionPersistence(
    promptSequence,
    sequenceBoundDogma || activeDogma,
    sequenceVideoData
  );

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // === TIMELINE STATE ===
  const [timelineState, setTimelineState] = useState<TimelineState>({
    project: null,
    tracks: [
      { id: 'v1', type: 'video', name: 'V1', order: 0, locked: false, muted: false, visible: true, height: 56 },
      { id: 'a1', type: 'audio', name: 'A1', order: 1, locked: false, muted: false, visible: true, height: 32 },
    ],
    segments: [],
    selectedSegmentIds: [],
    selectedTrackId: 'v1',
    expandedSegmentIds: [],
    generationQueue: [],
    playheadSec: 0
  });
  const [iaPanelTab, setIaPanelTab] = useState<"prompt" | "keyframes" | "edit-image" | "edit-video" | "versions">('prompt');
  const [isVerticalToggle, setIsVerticalToggle] = useState(false);

  // === SOURCE VIEWER STATE (NLE workflow) ===
  const [sourceMedia, setSourceMedia] = useState<import('./types/media').RushMedia | null>(null);

  // === TIMELINE PLAYBACK ENGINE ===
  const totalDuration = useMemo(() => {
    if (timelineState.segments.length === 0) return 30;
    return Math.max(30, ...timelineState.segments.map(s => s.outSec));
  }, [timelineState.segments]);

  const {
    isPlaying,
    currentTime,
    play,
    pause,
    seek,
    togglePlayPause,
    engine
  } = usePlaybackEngine({
    fps: timelineState.project?.fps || 25,
    totalDuration,
    onTimeUpdate: (time) => {
      // Sync React state with engine time
      setTimelineState(prev => ({ ...prev, playheadSec: time }));
    }
  });

  // === UNDO/REDO HISTORY ===
  const historyRef = useRef<{ past: TimelineState[]; future: TimelineState[] }>({ past: [], future: [] });
  const MAX_HISTORY = 50;

  // Track timeline changes for undo (call this before making changes)
  const pushToHistory = useCallback(() => {
    historyRef.current.past.push(JSON.parse(JSON.stringify(timelineState)));
    if (historyRef.current.past.length > MAX_HISTORY) {
      historyRef.current.past.shift(); // Remove oldest
    }
    historyRef.current.future = []; // Clear redo stack
  }, [timelineState]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (historyRef.current.past.length === 0) {
      console.log('[Undo] Nothing to undo');
      return;
    }
    const previousState = historyRef.current.past.pop()!;
    historyRef.current.future.push(JSON.parse(JSON.stringify(timelineState)));
    setTimelineState(previousState);
    console.log('[Undo] Restored previous state');
  }, [timelineState]);

  // Redo handler
  const handleRedo = useCallback(() => {
    if (historyRef.current.future.length === 0) {
      console.log('[Redo] Nothing to redo');
      return;
    }
    const nextState = historyRef.current.future.pop()!;
    historyRef.current.past.push(JSON.parse(JSON.stringify(timelineState)));
    setTimelineState(nextState);
    console.log('[Redo] Restored next state');
  }, [timelineState]);

  // Auto-open profile modal if no profile
  useEffect(() => {
    // Delay slightly to allow auto-login check in hook
    const timer = setTimeout(() => {
      if (!profile && !localStorage.getItem('studio_profile_id')) {
        setIsProfileModalOpen(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [profile]);

  // Start new session if profile exists but no session
  useEffect(() => {
    if (profile && !sessionId) {
      startNewSession();
    }
  }, [profile, sessionId, startNewSession]);

  const handleProfileConfirm = async (identifier: string) => {
    setIsLoadingHistory(true);
    try {
      await login(identifier);
      setIsProfileModalOpen(false);
      // startNewSession will trigger via effect
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistory = async () => {
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
      const sessions = await listHistory();
      setHistorySessions(sessions);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleRestoreSession = async (session: any) => {
    setIsLoadingHistory(true);
    try {
      const { session: restoredSession, storyboards } = await restoreSession(session.id);

      // Restore State
      // 1. Prompts
      const restoredPromptSequence: PromptSequence = {
        id: restoredSession.id,
        dogmaId: restoredSession.dogma_id || null,
        status: PromptSequenceStatus.CLEAN,
        createdAt: restoredSession.created_at,
        mainPrompt: restoredSession.main_prompt || '',
        extensionPrompts: Array.isArray(restoredSession.extension_prompts)
          ? restoredSession.extension_prompts
          : [],
        dirtyExtensions: Array.isArray(restoredSession.dirty_extensions)
          ? restoredSession.dirty_extensions
          : []
      };
      setPromptSequence(restoredPromptSequence); // Fixed double set

      // 2. Dogma
      if (restoredSession.dogma_snapshot) {
        setSequenceBoundDogma(restoredSession.dogma_snapshot);
      } else if (restoredSession.dogma_id) {
        // Try to find in library
        const d = dogmas.find((dg: Dogma) => dg.id === restoredSession.dogma_id);
        if (d) setSequenceBoundDogma(d);
      }

      // 3. Videos
      if (restoredSession.sequence_video_data) {
        setSequenceVideoData(restoredSession.sequence_video_data);
      }

      // 4. Storyboards
      if (storyboards) {
        setStoryboardByIndex(storyboards);
      }

      // 5. Active Index
      setActivePromptIndex(restoredSession.active_prompt_index ?? null);

      setIsHistoryModalOpen(false);
    } catch (e) {
      console.error('Restore failed', e);
      setErrorMessage('Failed to restore session');
    } finally {
      setIsLoadingHistory(false);
    }
  };


  const [initialFormValues, setInitialFormValues] =
    useState<GenerateVideoParams | null>(null);

  // State for API key error message to show in dialog
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    // Check server config to determine if we need user API key
    const initCheck = async () => {
      try {
        const config = await fetchGeminiConfig();

        // If server has key configured, no dialog needed
        if (config.hasServerKey) {
          setShowApiKeyDialog(false);
          setHasCustomKey(true);
          return;
        }

        // BYOK Strict: Never check localStorage. 
        // Always prompt if we don't have a server key and no memory key is set.
        if (!apiKey) {
          setShowApiKeyDialog(true);
          setHasCustomKey(false);
        }
      } catch {
        // Fallback: Assume BYOK needed if check fails
        if (!apiKey) {
          setShowApiKeyDialog(true);
          setHasCustomKey(false);
        }
      }
    };
    initCheck();
  }, [apiKey]); // Re-run if apiKey state changes (e.g. user entered it)

  // NOTE: No auto-injection of default dogmas. 
  // Users can import optional templates from data/dogmaTemplates.ts via DogmaManager

  const confirmUnsavedVideo = useCallback(() => {
    if (appState === AppState.SUCCESS && !isCurrentVideoSaved) {
      return window.confirm(
        'You have an unsaved video. Are you sure you want to continue without saving? This action will discard the current video.',
      );
    }
    return true; // Continue if not in success state or if video is saved
  }, [appState, isCurrentVideoSaved]);

  const showStatusError = (message: string) => {
    setErrorMessage(message);
    setAppState(AppState.ERROR);
  };

  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('Video generation cancelled by user.');
    }
  }, []);

  // === TIMELINE HANDLERS (Phase A Integration) ===

  // === EMERGENCY BACKUP: JSON SAVE/LOAD ===
  const handleSaveProjectJson = useCallback(() => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      timelineState,
      promptSequence,
      sequenceVideoData // Also save existing video references
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_backup_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [timelineState, promptSequence, sequenceVideoData]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadProjectJson = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.timelineState) {
          setTimelineState(json.timelineState);
          console.log('[Backup] Timeline restored');
        }
        if (json.promptSequence) {
          setPromptSequence(json.promptSequence);
          console.log('[Backup] PromptSequence restored');
        }
        if (json.sequenceVideoData) {
          setSequenceVideoData(json.sequenceVideoData);
          console.log('[Backup] VideoData restored');
        }
        alert('Projet restauré avec succès !');
      } catch (err) {
        console.error('Failed to parse backup', err);
        alert('Erreur: Fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  }, []);

  const handleSegmentReorder = useCallback(async (newSegments: SegmentWithUI[]) => {
    // Optimistic update
    setTimelineState(prev => ({ ...prev, segments: newSegments }));

    // Persist to backend json backup if needed, but here strictly local
    const projectId = timelineState.project?.id;
    if (projectId) {
      try {
        const orders = Object.fromEntries(newSegments.map((s, i) => [s.id, i + 1]));
        await TimelineService.reorderSegments(projectId, orders);
        console.log('[Timeline] Reorder persisted');
      } catch (err) {
        console.error('[Timeline] Reorder failed:', err);
        // Could revert here if needed
      }
    }
  }, [timelineState.project]);

  const handleSegmentDelete = useCallback(async (segmentId: string, ripple: boolean = false) => {
    const segment = timelineState.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const deletedDuration = segment.durationSec;
    const deletedEnd = segment.outSec;
    const trackId = segment.trackId;

    // Find linked segments to also delete
    const linkedIds = segment.linkGroupId
      ? timelineState.segments
        .filter(s => s.linkGroupId === segment.linkGroupId)
        .map(s => s.id)
      : [segmentId];

    setTimelineState(prev => {
      let newSegments = prev.segments.filter(s => !linkedIds.includes(s.id));

      // RIPPLE: Shift following segments on same track(s) left
      if (ripple) {
        const tracksToShift = segment.linkGroupId
          ? ['v1', 'a1'] // Shift both linked tracks
          : [trackId];

        newSegments = newSegments.map(seg => {
          if (tracksToShift.includes(seg.trackId) && seg.inSec >= deletedEnd) {
            return {
              ...seg,
              inSec: seg.inSec - deletedDuration,
              outSec: seg.outSec - deletedDuration
            };
          }
          return seg;
        });
        console.log(`[RIPPLE DELETE] Shifted segments left by ${deletedDuration}s`);
      }

      return {
        ...prev,
        segments: newSegments,
        selectedSegmentIds: prev.selectedSegmentIds.filter(id => !linkedIds.includes(id))
      };
    });

    // Persist to backend
    try {
      for (const id of linkedIds) {
        await TimelineService.deleteSegment(id);
      }
      console.log('[Timeline] Segment deleted:', linkedIds.join(', '));
    } catch (err) {
      console.error('[Timeline] Delete failed:', err);
    }
  }, [timelineState.segments]);

  const handleSegmentDuplicate = useCallback(async (segmentId: string) => {
    const segment = timelineState.segments.find(s => s.id === segmentId);
    if (!segment) return;

    try {
      // Persist to backend first
      const newSegment = await TimelineService.duplicateSegment(segment);
      const duplicateWithUI: SegmentWithUI = { ...newSegment, uiState: 'idle' };

      // Update local state
      setTimelineState(prev => {
        const segmentIndex = prev.segments.findIndex(s => s.id === segmentId);
        if (segmentIndex === -1) return prev;
        const newSegments = [...prev.segments];
        newSegments.splice(segmentIndex + 1, 0, duplicateWithUI);
        return { ...prev, segments: newSegments };
      });
      console.log('[Timeline] Segment duplicated:', newSegment.id);
    } catch (err) {
      console.error('[Timeline] Duplicate failed:', err);
      // Fallback to local-only duplicate
      setTimelineState(prev => {
        const segmentIndex = prev.segments.findIndex(s => s.id === segmentId);
        if (segmentIndex === -1) return prev;
        const original = prev.segments[segmentIndex];
        const duplicate: SegmentWithUI = {
          ...original,
          id: crypto.randomUUID(),
          label: `${original.label || 'Segment'} (Copy)`,
          createdAt: new Date().toISOString(),
          uiState: 'idle'
        };
        const newSegments = [...prev.segments];
        newSegments.splice(segmentIndex + 1, 0, duplicate);
        return { ...prev, segments: newSegments };
      });
    }
  }, [timelineState.segments]);

  // === SPLIT SEGMENT HANDLER ===
  const handleSplitSegment = useCallback((segmentId: string, atSec: number) => {
    setTimelineState(prev => {
      const segmentIndex = prev.segments.findIndex(s => s.id === segmentId);
      if (segmentIndex === -1) return prev;

      const original = prev.segments[segmentIndex];
      const fps = prev.project?.fps || 25;

      // SNAP: Round cut point to nearest frame
      const snappedSec = Math.round(atSec * fps) / fps;

      // Don't split if at edges
      if (snappedSec <= original.inSec || snappedSec >= original.outSec) return prev;

      // Frame calculations
      const cutFrame = Math.round(snappedSec * fps);
      const originalStartFrame = original.startFrame ?? Math.round(original.inSec * fps);
      const originalEndFrame = originalStartFrame + (original.durationFrames ?? Math.round(original.durationSec * fps));

      const leftDurationFrames = cutFrame - originalStartFrame;
      const rightDurationFrames = originalEndFrame - cutFrame;

      // Create two new segments from the split
      const leftSegment: SegmentWithUI = {
        ...original,
        id: `${original.id}_left_${Date.now()}`,
        outSec: snappedSec,
        durationSec: snappedSec - original.inSec,
        durationFrames: leftDurationFrames,
        label: `${original.label || 'Segment'} (1)`,
        updatedAt: new Date().toISOString()
      };

      const rightSegment: SegmentWithUI = {
        ...original,
        id: `${original.id}_right_${Date.now()}`,
        inSec: snappedSec,
        durationSec: original.outSec - snappedSec,
        startFrame: cutFrame,
        durationFrames: rightDurationFrames,
        label: `${original.label || 'Segment'} (2)`,
        order: original.order + 1,
        updatedAt: new Date().toISOString()
      };

      // Replace original with two new segments
      const newSegments = [...prev.segments];
      newSegments.splice(segmentIndex, 1, leftSegment, rightSegment);

      // Update order for subsequent segments
      const reorderedSegments = newSegments.map((s, i) => ({ ...s, order: i }));

      console.log(`[Timeline] Split segment ${segmentId} at frame ${cutFrame} (${snappedSec.toFixed(3)}s)`);

      return {
        ...prev,
        segments: reorderedSegments,
        selectedSegmentIds: [rightSegment.id] // Select the right part
      };
    });
  }, []);

  // === SEQUENCE BIN HANDLERS (TODO: Re-enable when types align) ===
  // These handlers are temporarily disabled due to generateVideo return type changes
  // and SegmentWithUI interface mismatches. The bin system is integrated but these
  // specific handlers need updating.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSlotGenerate = async (_binId: string, _slotId: string) => {
    console.log('[Slot] Generation handler pending type alignment');
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSlotAddToTimeline = (_binId: string, _slotId: string) => {
    console.log('[Slot] Add to timeline handler pending type alignment');
  };


  // === KEYBOARD SHORTCUTS (NLE) ===
  const FPS = 30; // Project FPS
  const frameStep = 1 / FPS;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Only active on Editing tab
      if (activeTab !== 'editing') return;
      // Ignore if SourceViewer is open (it has its own shortcuts)
      if (sourceMedia) return;

      const { selectedSegmentIds, segments, playheadSec } = timelineState;
      const selectedId = selectedSegmentIds.length > 0 ? selectedSegmentIds[0] : null;

      // Calculate total duration
      const totalDuration = segments.length > 0
        ? Math.max(...segments.map(s => s.outSec))
        : 30;

      switch (e.key) {
        // === UNDO/REDO (Ctrl+Z / Ctrl+Y) ===
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo(); // Ctrl+Shift+Z = Redo
            } else {
              handleUndo(); // Ctrl+Z = Undo
            }
          }
          break;

        case 'y':
        case 'Y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRedo(); // Ctrl+Y = Redo
          }
          break;

        // === FRAME NAVIGATION ===
        case 'ArrowLeft':
          e.preventDefault();
          const stepBack = e.shiftKey ? 1 : frameStep;
          setTimelineState(prev => ({
            ...prev,
            playheadSec: Math.max(0, prev.playheadSec - stepBack)
          }));
          break;

        case 'ArrowRight':
          e.preventDefault();
          const stepForward = e.shiftKey ? 1 : frameStep;
          setTimelineState(prev => ({
            ...prev,
            playheadSec: Math.min(totalDuration, prev.playheadSec + stepForward)
          }));
          break;

        case 'Home':
          e.preventDefault();
          setTimelineState(prev => ({ ...prev, playheadSec: 0 }));
          break;

        case 'End':
          e.preventDefault();
          setTimelineState(prev => ({ ...prev, playheadSec: totalDuration }));
          break;

        // === SPLIT/RAZOR (X) - Single segment or Shift+X for all tracks ===
        case 'x':
        case 'X':
          e.preventDefault();
          if (e.shiftKey) {
            // SHIFT+X: Cut ALL segments across ALL tracks at playhead
            const segmentsAtPlayhead = segments.filter(s =>
              playheadSec > s.inSec && playheadSec < s.outSec
            );
            console.log(`[Razor] Shift+X: Cutting ${segmentsAtPlayhead.length} segments at ${playheadSec.toFixed(2)}s`);
            for (const seg of segmentsAtPlayhead) {
              const segTrack = timelineState.tracks.find(t => t.id === seg.trackId);
              if (!seg.locked && !segTrack?.locked) {
                handleSplitSegment(seg.id, playheadSec);
              }
            }
          } else {
            // X: Cut single segment at playhead
            const segmentAtPlayhead = segments.find(s =>
              playheadSec > s.inSec && playheadSec < s.outSec
            );
            if (segmentAtPlayhead) {
              const segTrack = timelineState.tracks.find(t => t.id === segmentAtPlayhead.trackId);
              if (!segmentAtPlayhead.locked && !segTrack?.locked) {
                handleSplitSegment(segmentAtPlayhead.id, playheadSec);
              }
            }
          }
          break;

        // === DELETE (Delete/Backspace) - Shift for ripple delete ===
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (selectedId) {
            const segment = segments.find(s => s.id === selectedId);
            if (segment) {
              const segTrack = timelineState.tracks.find(t => t.id === segment.trackId);
              if (!segment.locked && !segTrack?.locked) {
                // Shift = ripple delete (shift following segments left)
                handleSegmentDelete(selectedId, e.shiftKey);
              }
            }
          }
          break;

        // === PLAY/PAUSE (Space) ===
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;

        // === MARK IN/OUT (I/O) - for selected segment ===
        case 'i':
        case 'I':
          if (selectedId) {
            setTimelineState(prev => ({
              ...prev,
              segments: prev.segments.map(s => s.id === selectedId
                ? { ...s, inSec: playheadSec, durationSec: s.outSec - playheadSec }
                : s)
            }));
            e.preventDefault();
          }
          break;

        case 'o':
        case 'O':
          if (selectedId) {
            setTimelineState(prev => ({
              ...prev,
              segments: prev.segments.map(s => s.id === selectedId
                ? { ...s, outSec: playheadSec, durationSec: playheadSec - s.inSec }
                : s)
            }));
            e.preventDefault();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timelineState, activeTab, sourceMedia, handleSegmentDelete, handleSplitSegment, frameStep, handleUndo, handleRedo]);

  const generateThumbnail = async (videoBlob: Blob): Promise<string> => {
    const objectUrl = URL.createObjectURL(videoBlob);
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;

      const onSeeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          video.removeEventListener('seeked', onSeeked);
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        URL.revokeObjectURL(objectUrl);
        video.removeEventListener('seeked', onSeeked);
        resolve(base64);
      };

      video.addEventListener('seeked', onSeeked);

      video.onloadeddata = () => {
        video.currentTime = 0.5;
      };

      video.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };

      video.load();
    });
  };

  // === HELPER: Generate Keyframe (Nano) ===
  const generateKeyframe = useCallback(async (segmentIndex: number, prompt: string) => {
    try {
      // Use bound dogma if available, otherwise active
      const dogmaToUse = sequenceBoundDogma ?? activeDogma;
      console.log(`[ImageFirst] Generating keyframe for segment ${segmentIndex} with dogma:`, dogmaToUse?.title);

      // P0: Use quality:'pro' for root keyframes (segment 0)
      const quality = segmentIndex === 0 ? 'pro' : undefined;
      console.log(`[ImageFirst] Using quality=${quality || 'default'} for segment ${segmentIndex}`);

      const result = await generateNanoPreview({
        textPrompt: prompt,
        dogma: dogmaToUse,
        quality: quality || 'pro',
        apiKey: apiKey || undefined, // P0.7: BYOK
      });

      if (result.previewImage) {
        setStoryboardByIndex(prev => ({
          ...prev,
          [segmentIndex]: {
            id: crypto.randomUUID(),
            owner: segmentIndex === 0 ? 'root' : 'extension',
            previewImage: result.previewImage,
            previewPrompt: result.previewPrompt || prompt,
            segmentIndex,
            cameraNotes: result.cameraNotes,
            movementNotes: result.movementNotes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        }));
        console.log(`[ImageFirst] Keyframe ${segmentIndex} generated successfully`);

        // If Root, we can now show the Mode Selection UI
        if (segmentIndex === 0) {
          setSequenceMode('plan-sequence');
        }
      }
    } catch (err: any) {
      console.warn(`[ImageFirst] Failed to generate keyframe ${segmentIndex}:`, err);

      // P0: Detect API key errors and show dialog
      if (err?.isApiKeyError || err?.message?.includes('API_KEY_ERROR')) {
        console.log('[ImageFirst] API key error detected, showing dialog');
        setShowApiKeyDialog(true);
        setErrorMessage('API key required or invalid. Please enter a valid Gemini API key.');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to generate preview.');
      }
    }
  }, [sequenceBoundDogma, activeDogma]);

  const handleGenerate = useCallback(
    async (params: GenerateVideoParams) => {
      // BYOK Strict: Check React State
      if (!apiKey && !hasCustomKey) {
        setShowApiKeyDialog(true);
        return;
      }

      abortControllerRef.current = new AbortController();

      let currentPromptIndex = -1;
      if (promptSequence) {
        if (activePromptIndex !== null) {
          currentPromptIndex = activePromptIndex;
        } else {
          const allPrompts = [
            promptSequence.mainPrompt,
            ...promptSequence.extensionPrompts,
          ];
          const matchingIndex = allPrompts.findIndex(
            (p) => p === params.prompt,
          );
          if (matchingIndex !== -1) {
            currentPromptIndex = matchingIndex;
          }
        }

        if (currentPromptIndex !== -1) {
          setActivePromptIndex(currentPromptIndex);
          setSequenceProgress({
            current: currentPromptIndex + 1,
            total: promptSequence.extensionPrompts.length + 1,
          });
        } else {
          setActivePromptIndex(null);
          setSequenceProgress(null);
        }
      } else {
        setActivePromptIndex(null);
        setSequenceProgress(null);
      }

      // ═══════════════════════════════════════════════════════════════════
      // GUARDRAIL 1 & 2: Validate base video for extensions, enforce mode
      // ═══════════════════════════════════════════════════════════════════
      let effectiveParams = { ...params };

      if (promptSequence && currentPromptIndex !== -1) {
        if (currentPromptIndex === 0) {
          // ROOT SHOT: Must be TEXT_TO_VIDEO, no base video
          console.log('[Sequence] Root shot index=0 → mode=TEXT_TO_VIDEO (no base video)');

          // IMAGE-FIRST ENFORCEMENT
          // If no keyframe exists for the root shot, we MUST generate one first via Nano
          if (!storyboardByIndex[0]) {
            console.log('[ImageFirst] No keyframe found for root shot. Enforcing Nano preview.');
            // Generate keyframe using the prompt
            generateKeyframe(0, effectiveParams.prompt);
            // Optionally set state to indicate we are in preview mode
            // Inform user via temporary message (using error message slot for visibility, or console)
            console.log('[ImageFirst] Preview generation triggered. Pausing video generation.');
            // Abort video generation
            return;
          }

          // Force TEXT_TO_VIDEO for root shot (unless using frames/references mode)
          if (effectiveParams.mode === GenerationMode.EXTEND_VIDEO) {
            console.warn('[Sequence] WARNING: Root shot had EXTEND_VIDEO mode, forcing TEXT_TO_VIDEO');
            effectiveParams = {
              ...effectiveParams,
              mode: GenerationMode.TEXT_TO_VIDEO,
              inputVideoObject: null,
            };
          }
        } else {
          // EXTENSION: Must have base video with valid URI
          const baseVideoData = sequenceVideoData[currentPromptIndex - 1];
          const baseVideo = baseVideoData?.video;
          const baseVideoUri = baseVideo?.uri;

          if (!baseVideoUri) {
            // GUARDRAIL 1: Block extension without base video
            console.warn(`[Sequence] Cannot generate extension index=${currentPromptIndex}: missing base video for index=${currentPromptIndex - 1}`);
            console.warn('[Sequence] WARNING: extension requested without base video, blocking generation');
            setErrorMessage(
              `The previous shot (Shot ${currentPromptIndex}) is not ready yet. Please generate or wait for the previous video before creating this extension.`
            );
            return; // BLOCK - do not proceed
          }

          // GUARDRAIL 2: Log and enforce extend mode with proper base video
          console.log(`[Sequence] Preparing extension index=${currentPromptIndex} with base video from index=${currentPromptIndex - 1}: { uri: "${baseVideoUri}" }`);
          console.log(`[Sequence] Extension index=${currentPromptIndex} → mode=EXTEND_VIDEO, baseVideoUri=${baseVideoUri}`);

          // Force EXTEND_VIDEO mode with the correct base video
          effectiveParams = {
            ...effectiveParams,
            mode: GenerationMode.EXTEND_VIDEO,
            inputVideoObject: baseVideo,
          };
        }
      }
      // ═══════════════════════════════════════════════════════════════════
      // EXTERNAL VIDEO CONTINUATION: Use TEXT_TO_VIDEO with last frame
      // ═══════════════════════════════════════════════════════════════════
      // Veo Extension mode ONLY works with Veo-generated videos.
      // For external videos, we use TEXT_TO_VIDEO with the last frame as startFrame.
      // The AI prompt already includes continuity context, so the result is seamless.
      // EXTERNAL VIDEO DETECTION: Only trigger for explicitly external sources
      // isExternalVideoSource is ONLY set by handleStartExternalExtensionAssistant
      if (
        effectiveParams.mode === GenerationMode.EXTEND_VIDEO &&
        isExternalVideoSource &&
        originalVideoForExtension?.file
      ) {
        console.log('[External Video] Detected external video continuation request', {
          rootVideoName: originalVideoForExtension.file.name,
          hasExtensionContext: !!assistantExtensionContext,
        });

        // Switch to TEXT_TO_VIDEO mode with the last frame as visual anchor
        console.log('[External Video] Using TEXT_TO_VIDEO mode with startFrame (Veo Extension only supports Veo-generated videos)');

        effectiveParams = {
          ...effectiveParams,
          mode: GenerationMode.TEXT_TO_VIDEO,
          inputVideoObject: null, // Clear video reference - we use startFrame instead
          startFrame: assistantExtensionContext || effectiveParams.startFrame,
        };

        console.log('[External Video] Converted to TEXT_TO_VIDEO with startFrame:', {
          hasStartFrame: !!effectiveParams.startFrame,
          prompt: effectiveParams.prompt?.substring(0, 100) + '...',
        });
      }

      setAppState(AppState.LOADING);
      setErrorMessage(null);
      setLastConfig(effectiveParams);
      setInitialFormValues(null);

      if (
        !assistantExtensionContext &&
        effectiveParams.mode !== GenerationMode.EXTEND_VIDEO
      ) {
        setAssistantExtensionContext(null);
        setAssistantMotionDescription(null);
        setOriginalVideoForExtension(null);
        setIsExternalVideoSource(false); // Reset flag
      }

      // Don't clear assistantImage immediately so context radar persists during load
      // setAssistantImage(null); 
      setAssistantReferenceVideo(null);
      setMentionedCharacters([]);

      if (currentPromptIndex === 0) {
        setMainPromptConfig(effectiveParams);
      }

      try {
        // GUARDRAIL 4: Log the call for chain verification
        if (promptSequence && currentPromptIndex > 0) {
          const baseVideoUri = effectiveParams.inputVideoObject?.uri;
          console.log(`[Sequence] Calling generateVideo for extension index=${currentPromptIndex} with mode=EXTEND_VIDEO and baseVideoUri=${baseVideoUri}`);
        }

        // Use Gemini API for video generation
        const res = await generateVideo(
          effectiveParams,
          abortControllerRef.current.signal,
          undefined,
          apiKey || undefined // P0.7: BYOK
        );
        const { objectUrl, blob, video } = res;

        if (promptSequence && currentPromptIndex !== -1) {
          try {
            const thumbnail = await generateThumbnail(blob);
            // GUARDRAIL 4: Clear chain logging
            if (currentPromptIndex === 0) {
              console.log(`[Sequence] Stored root video for index=0: { uri: "${video?.uri}" }`);
            } else {
              console.log(`[Sequence] Stored extension video for index=${currentPromptIndex}: { uri: "${video?.uri}" }`);
            }
            setSequenceVideoData((prev) => ({
              ...prev,
              [currentPromptIndex]: {
                video,
                blob,
                url: objectUrl,
                thumbnail,
                prompt: currentPromptIndex === 0 ? promptSequence.mainPrompt : (promptSequence.extensionPrompts[currentPromptIndex - 1] || ''),
                isExtension: currentPromptIndex > 0,
                status: 'completed' as const,
                createdAt: new Date().toISOString()
              },
            }));
          } catch (thumbError) {
            console.error(
              'Failed to generate thumbnail for sequence item.',
              thumbError,
            );
            setSequenceVideoData((prev) => ({
              ...prev,
              [currentPromptIndex]: {
                video,
                blob,
                url: objectUrl,
                thumbnail: '',
                prompt: currentPromptIndex === 0 ? promptSequence.mainPrompt : (promptSequence.extensionPrompts[currentPromptIndex - 1] || ''),
                isExtension: currentPromptIndex > 0,
                status: 'completed' as const,
                createdAt: new Date().toISOString()
              },
            }));
          }
        }

        setVideoUrl(objectUrl);
        setLastVideoBlob(blob);
        setLastVideoObject(video);
        setAppState(AppState.SUCCESS);
        setCurrentStage(AppStage.RESULT);
        setIsCurrentVideoSaved(false);
        // Now clear assistant image as we move to result
        setAssistantImage(null);

        if (promptSequence && currentPromptIndex !== -1) {
          setActivePromptIndex(currentPromptIndex + 1);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setAppState(AppState.IDLE);
          setInitialFormValues(params);
          setErrorMessage(null);
          setActivePromptIndex(null);
          setSequenceProgress(null);
          return;
        }

        console.error('Video generation failed:', error);

        // Handle structured API errors from callVeoBackend
        const apiError = error as ApiError;
        if (apiError.status && apiError.error) {
          // Structured error from our backend
          if (apiError.status === 401 && apiError.error === 'API_KEY_MISSING') {
            setApiKeyError('Aucune clé API configurée. Veuillez entrer votre clé Gemini.');
            setShowApiKeyDialog(true);
            setAppState(AppState.IDLE);
            return;
          } else if (apiError.status === 401 && apiError.error === 'API_KEY_INVALID') {
            setApiKeyError('Clé API invalide. Vérifiez votre clé et réessayez.');
            setShowApiKeyDialog(true);
            setAppState(AppState.IDLE);
            return;
          } else if (apiError.status === 404 && apiError.error === 'MODEL_NOT_FOUND') {
            // Model errors: show in UI, DON'T open API key dialog
            showStatusError(`Le modèle Veo n'est pas disponible: ${apiError.data?.details || 'Vérifiez que votre clé API dispose de l\'accès aux modèles Veo 3.1.'}`);
            return;
          } else if (apiError.status === 400) {
            showStatusError(`Requête invalide: ${apiError.data?.details || 'Vérifiez vos paramètres.'}`);
            return;
          } else {
            showStatusError('Erreur serveur. Réessayez plus tard.');
            return;
          }
        }

        // Legacy error handling for Error instances
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred.';

        let userFriendlyMessage = `Video generation failed: ${errorMessage}`;
        let shouldOpenDialog = false;
        let dialogErrorMsg: string | null = null;

        if (typeof errorMessage === 'string') {
          // Model errors: show in UI, DON'T open API key dialog
          if (errorMessage.includes('MODEL_NOT_FOUND') ||
            (errorMessage.toLowerCase().includes('model') && errorMessage.toLowerCase().includes('not found'))) {
            userFriendlyMessage = 'Le modèle Veo sélectionné n\'est pas disponible. Vérifiez que votre clé API dispose de l\'accès aux modèles Veo 3.1.';
            // Don't set shouldOpenDialog - model errors should NOT trigger key dialog
          } else if (
            errorMessage.includes('API_KEY_INVALID') ||
            errorMessage.includes('API key not valid') ||
            errorMessage.toLowerCase().includes('permission denied') ||
            errorMessage.includes('API_KEY_MISSING') ||
            errorMessage.includes('403')
          ) {
            userFriendlyMessage = 'Votre clé API est invalide, manquante ou ne dispose pas des permissions requises.';
            dialogErrorMsg = 'Clé API invalide ou manquante.';
            shouldOpenDialog = true;
          }
        }

        showStatusError(userFriendlyMessage);
        if (shouldOpenDialog) {
          setApiKeyError(dialogErrorMsg);
          setShowApiKeyDialog(true);
        }
      }
    },
    [promptSequence, activePromptIndex, assistantExtensionContext],
  );

  const handleStartNewProject = useCallback(() => {
    if (!confirmUnsavedVideo()) return;

    console.log('[StateTransition] handleStartNewProject - Full reset');

    // Core state
    setAppState(AppState.IDLE);
    setCurrentStage(AppStage.PROMPTING);
    setVideoUrl(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);

    // Sequence state - CRITICAL: Clear everything including bound dogma
    setPromptSequence(null);
    setSequenceBoundDogma(null);  // Clear sequence-bound dogma
    setActivePromptIndex(null);
    setSequenceProgress(null);
    setSequenceVideoData({});
    setMainPromptConfig(null);

    // Context state
    setInitialFormValues(null);
    setOriginalVideoForExtension(null);
    setAssistantExtensionContext(null);
    setAssistantImage(null);
    setAssistantReferenceVideo(null);
    setAssistantMotionDescription(null);
    setMentionedCharacters([]);
    setIsExternalVideoSource(false);

    // NOTE: activeDogma (global library selection) is preserved - user may want same dogma for new project
    console.log('[StateTransition] Reset complete. Global activeDogma preserved:', activeDogmaId);
    setResetKey(prev => prev + 1);
  }, [confirmUnsavedVideo, activeDogmaId]);

  // =========================================================================
  // NANO BANANA PRO: Centralized editor controller
  // =========================================================================

  /**
   * Derive target from segment index - strict mapping (no truthy/falsy)
   */
  const deriveTargetFromIndex = (segmentIndex: number | null): 'root' | 'extension' | 'character' => {
    if (segmentIndex === null) return 'character';
    if (segmentIndex === 0) return 'root';
    return 'extension';
  };

  /**
   * Open Nano editor from any entry point (stylet, thumbnails, drift, characters)
   */
  const openNanoEditor = useCallback((opts: {
    segmentIndex: number | null;
    baseImage?: ImageFile;
    initialPrompt?: string;
  }) => {
    const target = deriveTargetFromIndex(opts.segmentIndex);
    // CRITICAL: effectiveDogma = sequenceBoundDogma ?? activeDogma
    const effectiveDogma = promptSequence ? (sequenceBoundDogma ?? activeDogma) : activeDogma;

    console.log('[NanoEditor] Opening with context:', {
      segmentIndex: opts.segmentIndex,
      target,
      dogmaId: effectiveDogma?.id,
      hasBaseImage: !!opts.baseImage,
    });

    setNanoEditorContext({
      segmentIndex: opts.segmentIndex,
      target,
      dogma: effectiveDogma,
      baseImage: opts.baseImage,
      initialPrompt: opts.initialPrompt,
    });
  }, [promptSequence, sequenceBoundDogma, activeDogma]);

  /**
   * Close Nano editor and reset context
   */
  const closeNanoEditor = useCallback(() => {
    console.log('[NanoEditor] Closing');
    setNanoEditorContext(null);
  }, []);

  /**
   * Handle Apply from Nano editor - updates prompts and storyboard
   * CRITICAL: Proper handling for root/extension/character
   */
  const handleNanoApply = useCallback((payload: NanoApplyPayload) => {
    console.log('[NanoEditor] Apply payload:', {
      target: payload.target,
      segmentIndex: payload.segmentIndex,
      promptLength: payload.previewPrompt.length,
    });

    // Helper: Trigger background upgrade for vignettes
    const triggerProUpgrade = async (idx: number) => {
      if (sequenceMode === 'decoupage' || payload.target === 'root') {
        console.log(`[NanoUpgrade] Upgrading segment ${idx} to Pro...`);
        try {
          const res = await generateNanoPreview({
            textPrompt: payload.previewPrompt,
            dogma: sequenceBoundDogma ?? activeDogma,
            quality: 'pro',
            target: payload.target
          });
          if (res.previewImage) {
            console.log(`[NanoUpgrade] Upgrade complete for ${idx}`);
            setStoryboardByIndex(prev => ({
              ...prev,
              [idx]: {
                ...prev[idx],
                id: crypto.randomUUID(),
                previewImage: res.previewImage,
                previewPrompt: res.previewPrompt || payload.previewPrompt // update prompt if refined
              }
            }));
          }
        } catch (e) { console.error('[NanoUpgrade] Failed:', e); }
      }
    };

    // Update storyboard preview
    const storyboardEntry: StoryboardPreview = {
      id: crypto.randomUUID(),
      owner: payload.target,
      segmentIndex: payload.segmentIndex ?? undefined,
      previewImage: payload.previewImage,
      previewPrompt: payload.previewPrompt,
      cameraNotes: payload.cameraNotes,
      movementNotes: payload.movementNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (payload.target === 'root') {
      // === ROOT: Update mainPrompt + mark all extensions dirty ===
      if (!promptSequence) return;

      const extensionsCount = promptSequence.extensionPrompts.length;
      const updatedSequence: PromptSequence = {
        ...promptSequence,
        mainPrompt: payload.previewPrompt,
        status: extensionsCount > 0 ? PromptSequenceStatus.ROOT_MODIFIED : PromptSequenceStatus.CLEAN,
        // CRITICAL: Extensions are indexed 1..N (not 0..N-1)
        dirtyExtensions: extensionsCount > 0
          ? Array.from({ length: extensionsCount }, (_, i) => i + 1)
          : [],
        rootModifiedAt: new Date().toISOString(),
      };

      setPromptSequence(updatedSequence);
      setStoryboardByIndex(prev => ({ ...prev, [0]: storyboardEntry }));
      triggerProUpgrade(0);

      if (extensionsCount > 0) {
        setErrorMessage(`⚠️ Prompt root modifié. ${extensionsCount} extension(s) à régénérer.`);
      }

    } else if (payload.target === 'extension') {
      // === EXTENSION: Update specific extension + remove from dirty ===
      if (!promptSequence || payload.segmentIndex === null) return;

      // CRITICAL: extensionPrompts uses 0-based index, segmentIndex is 1-based
      const extensionIndex = payload.segmentIndex - 1;
      if (extensionIndex < 0 || extensionIndex >= promptSequence.extensionPrompts.length) {
        console.error('[NanoEditor] Invalid extension index:', extensionIndex);
        return;
      }

      const newExtensionPrompts = [...promptSequence.extensionPrompts];
      newExtensionPrompts[extensionIndex] = payload.previewPrompt;

      // Remove this extension from dirtyExtensions
      const newDirtyExtensions = (promptSequence.dirtyExtensions || [])
        .filter(idx => idx !== payload.segmentIndex);

      const updatedSequence: PromptSequence = {
        ...promptSequence,
        extensionPrompts: newExtensionPrompts,
        dirtyExtensions: newDirtyExtensions,
        status: newDirtyExtensions.length > 0
          ? PromptSequenceStatus.EXTENSIONS_DIRTY
          : PromptSequenceStatus.CLEAN,
      };

      setPromptSequence(updatedSequence);
      setStoryboardByIndex(prev => ({ ...prev, [payload.segmentIndex!]: storyboardEntry }));
      triggerProUpgrade(payload.segmentIndex!);

    } else if (payload.target === 'character') {
      // === CHARACTER: Update character asset (no dirty logic) ===
      // TODO: Implement character storyboard storage when character system is extended
      console.log('[NanoEditor] Character apply - storing preview');
    }

    // Close editor and clear editing state
    closeNanoEditor();
    setEditingPromptDetails(null);
  }, [promptSequence, closeNanoEditor]);

  const handleRetryLastPrompt = useCallback(() => {
    if (lastConfig) {
      if (!confirmUnsavedVideo()) return;
      setInitialFormValues(lastConfig);
      setCurrentStage(AppStage.PROMPTING);
    }
  }, [lastConfig, confirmUnsavedVideo]);

  const handleExtendVideo = useCallback(() => {
    if (lastVideoBlob && lastVideoObject) {
      if (!confirmUnsavedVideo()) return;

      const originalVideoFile = new File([lastVideoBlob], 'original.mp4', {
        type: lastVideoBlob.type,
      });

      setOriginalVideoForExtension({
        file: originalVideoFile,
        base64: '', // Not needed for object passing
      });

      const newConfig: GenerateVideoParams = {
        ...(lastConfig as GenerateVideoParams),
        prompt: '',
        mode: GenerationMode.EXTEND_VIDEO,
        inputVideoObject: lastVideoObject,
        startFrame: null,
        endFrame: null,
        referenceImages: [],
      };
      setInitialFormValues(newConfig);
      setCurrentStage(AppStage.PROMPTING);
    }
  }, [lastConfig, lastVideoBlob, lastVideoObject, confirmUnsavedVideo]);

  const handleContinueFromFrame = useCallback(
    (frame: ImageFile) => {
      if (!confirmUnsavedVideo()) return;
      const newConfig: GenerateVideoParams = {
        ...(lastConfig as GenerateVideoParams),
        prompt: '',
        mode: GenerationMode.FRAMES_TO_VIDEO,
        startFrame: frame,
        endFrame: null,
        referenceImages: [],
        inputVideo: null,
        inputVideoObject: null,
      };
      setInitialFormValues(newConfig);
      setAssistantImage(frame); // Sync start frame to assistant image automatically
      setCurrentStage(AppStage.PROMPTING);
    },
    [lastConfig, confirmUnsavedVideo],
  );

  const handleEditCapturedFrame = (frame: ImageFile) => {
    setFrameToEdit(frame);
    setCurrentStage(AppStage.EDITING);
  };

  const handleFrameEditConfirm = (newImage: ImageFile) => {
    handleContinueFromFrame(newImage);
  };

  const handleApplyNano = (newImage: ImageFile) => {
    console.log('[Nano] Applying retouched image to current context');
    setAssistantImage(newImage);
  };

  // Handlers for API Key Dialog (BYOK Strict Mode)
  // Uses existing apiKey state (line 383) + Memory Vault
  const handleApiKeySet = (newKey: string) => {
    const trimmed = newKey.trim();
    if (trimmed.length >= 20) {
      setApiKey(trimmed);
      setRuntimeApiKey(trimmed); // Persist to Memory Vault
      setShowApiKeyDialog(false);
      setApiKeyError(null);
      setHasCustomKey(true);
    } else {
      setApiKeyError('Invalid API Key (too short)');
    }
  };

  const handleApiKeyClear = () => {
    setApiKey(null);
    setRuntimeApiKey(null); // Clear Memory Vault
    setShowApiKeyDialog(false);
    setHasCustomKey(false);
  };

  const handleSaveShot = (thumbnailBase64: string) => {
    if (lastConfig) {
      const newShot: SavedShot = {
        id: `shot-${Date.now()}`,
        prompt: lastConfig.prompt,
        thumbnail: thumbnailBase64,
        createdAt: new Date().toISOString(),
        model: lastConfig.model,
        aspectRatio: lastConfig.aspectRatio,
        resolution: lastConfig.resolution,
        mode: lastConfig.mode,
      };
      handleSaveShotToLibrary(newShot);
      setIsCurrentVideoSaved(true);
    }
  };

  const handleSequenceModeChange = (mode: 'plan-sequence' | 'decoupage') => {
    setSequenceMode(mode);
    if (mode === 'decoupage') {
      console.log('[Mode] Selected: Découpage - Opening 12 vignettes');
      // Open StoryboardPreviewModal for 12 vignettes
      if (storyboardByIndex[0]) {
        setStoryboardModalContext({
          segmentIndex: 0,
          baseImage: storyboardByIndex[0].previewImage,
          currentPrompt: storyboardByIndex[0].previewPrompt || '',
          mode: 'ordered-select', // Découpage mode uses ordered selection
        });
      }
    } else {
      console.log('[Mode] Selected: Plan-séquence');
    }
  };

  const handleLoadShot = (shot: SavedShot) => {
    if (!confirmUnsavedVideo()) return;
    const loadedConfig: GenerateVideoParams = {
      prompt: shot.prompt,
      model: shot.model,
      aspectRatio: shot.aspectRatio,
      resolution: shot.resolution,
      mode: shot.mode,
    };
    handleStartNewProject();
    setInitialFormValues(loadedConfig);
    setIsShotLibraryOpen(false);
  };

  const handleSequenceGenerated = (
    sequence: PromptSequence,
    isExtension: boolean,
  ) => {
    // If extension, we keep the original main prompt and just replace extensions
    // But currently generateSequenceFromConversation returns a full object
    // For now we trust the assistant's output
    console.log('[Studio] Sequence generated:', sequence);

    // Bind current dogma to this sequence to prevent drift
    if (activeDogma) {
      setSequenceBoundDogma(activeDogma);
      sequence.dogmaId = activeDogma.id;
    } else {
      setSequenceBoundDogma(null);
    }

    const scopedSequence = { ...sequence };
    setPromptSequence(scopedSequence);

    // === IMAGE-FIRST: Auto-generate keyframes ===
    if (autoKeyframesEnabled) {
      console.log('[ImageFirst] Auto-generating keyframes for sequence');
      setIsGeneratingKeyframes(true);

      // Generate keyframe for root (segmentIndex 0)
      const generateKeyframe = async (segmentIndex: number, prompt: string) => {
        try {
          const result = await generateNanoPreview({
            textPrompt: prompt,
            dogma: activeDogma,
          });
          if (result.previewImage) {
            setStoryboardByIndex(prev => ({
              ...prev,
              [segmentIndex]: {
                id: crypto.randomUUID(),
                owner: segmentIndex === 0 ? 'root' : 'extension',
                previewImage: result.previewImage,
                previewPrompt: result.previewPrompt || prompt,
                segmentIndex,
                cameraNotes: result.cameraNotes,
                movementNotes: result.movementNotes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            }));
            console.log(`[ImageFirst] Keyframe ${segmentIndex} generated`);
          }
        } catch (err) {
          console.warn(`[ImageFirst] Failed to generate keyframe ${segmentIndex}:`, err);
        }
      };

      // Generate root keyframe
      generateKeyframe(0, scopedSequence.mainPrompt);

      // Generate first extension keyframe if exists
      if (scopedSequence.extensionPrompts && scopedSequence.extensionPrompts[0]) {
        generateKeyframe(1, scopedSequence.extensionPrompts[0]);
      }

      // Mark generation complete after a delay
      setTimeout(() => setIsGeneratingKeyframes(false), 3000);
    }

    const firstPrompt = scopedSequence.mainPrompt;
    let configBase = lastConfig;

    if (isExtension) {
      if (originalVideoForExtension && lastConfig) {
        configBase = {
          ...lastConfig,
          mode: GenerationMode.EXTEND_VIDEO,
          prompt: '',
          inputVideoObject: lastVideoObject,
        };
      }
    } else {
      setOriginalVideoForExtension(null);
    }

    const newConfig: GenerateVideoParams = {
      ...(configBase as GenerateVideoParams),
      prompt: firstPrompt,
    };

    setInitialFormValues(newConfig);
    setCurrentStage(AppStage.PROMPTING);
  };

  const handleProvisionalSequence = (prompt: string) => {
    console.log('[Studio] Provisional sequence triggering keyframe:', prompt);
    const newSequence: PromptSequence = {
      mainPrompt: prompt,
      extensionPrompts: [],
      dogmaId: activeDogma?.id,
      dirtyExtensions: [],
      status: PromptSequenceStatus.CLEAN,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    // Bind dogma
    if (activeDogma) {
      setSequenceBoundDogma(activeDogma);
    }

    setPromptSequence(newSequence);
    setSequenceVideoData({});
    setStoryboardByIndex({}); // Clear old
    setActivePromptIndex(0);

    // Trigger keyframe generation
    // We reuse the logic from generateKeyframe which is internal to handleGenerate
    // But we need to call generateNanoPreview manually here since generateKeyframe is not globally scoped

    // Define async worker
    const generateProvisionalKeyframe = async () => {
      try {
        // P0: Force quality='pro' for root provisional keyframe + pass apiKey
        const result = await generateNanoPreview({
          textPrompt: prompt,
          dogma: activeDogma,
          quality: 'pro', // Explicitly request pro quality
          target: 'root',
          apiKey: apiKey || undefined
        });

        if (result.previewImage) {
          setStoryboardByIndex(prev => ({
            ...prev,
            [0]: {
              id: crypto.randomUUID(),
              owner: 'root',
              previewImage: result.previewImage,
              previewPrompt: result.previewPrompt || prompt,
              segmentIndex: 0,
              cameraNotes: result.cameraNotes,
              movementNotes: result.movementNotes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          }));
          console.log('[ImageFirst] Provisional keyframe generated (pro)');
        }
      } catch (e) {
        console.error('[ImageFirst] Failed to generate provisional keyframe:', e);
        setErrorMessage(e instanceof Error ? e.message : 'Failed to generate preview.');
      }
    };

    generateProvisionalKeyframe();
  };

  const handleSelectPromptFromSequence = (prompt: string, index: number) => {
    const isMainPrompt = index === 0;
    if (!isMainPrompt) {
      console.log('[Sequence] Setting up Extension', index, 'with base video:', sequenceVideoData[index - 1]?.video);
    }
    const baseConfig = isMainPrompt
      ? mainPromptConfig
      : sequenceVideoData[index - 1]
        ? {
          ...mainPromptConfig,
          mode: GenerationMode.EXTEND_VIDEO,
          inputVideoObject: sequenceVideoData[index - 1].video,
          prompt: '',
        }
        : null;

    if (baseConfig) {
      const newConfig: GenerateVideoParams = {
        ...(baseConfig as GenerateVideoParams),
        prompt,
      };
      setInitialFormValues(newConfig);
      setActivePromptIndex(index);
    } else {
      // GUARDRAIL 3: Block early selection of extensions
      console.warn(`[Sequence] Blocked selection of extension index=${index}: previous shot (index=${index - 1}) not ready`);
      setErrorMessage(
        `Cannot select Extension ${index}: Shot ${index} must be generated first.`
      );
    }
  };

  const handleContinueSequence = () => {
    if (
      promptSequence &&
      activePromptIndex !== null &&
      activePromptIndex < promptSequence.extensionPrompts.length + 1
    ) {
      const nextIndex = activePromptIndex;
      const nextPrompt = [
        promptSequence.mainPrompt,
        ...promptSequence.extensionPrompts,
      ][nextIndex];
      const previousVideo = sequenceVideoData[nextIndex - 1];

      if (previousVideo?.video?.uri) {
        // GUARDRAIL 4: Log the chain clearly
        console.log(`[Sequence] Preparing extension index=${nextIndex} with base video from index=${nextIndex - 1}: { uri: "${previousVideo.video.uri}" }`);
        const newConfig: GenerateVideoParams = {
          ...(mainPromptConfig as GenerateVideoParams),
          prompt: nextPrompt,
          mode: GenerationMode.EXTEND_VIDEO,
          inputVideoObject: previousVideo.video,
        };
        setInitialFormValues(newConfig);
        setCurrentStage(AppStage.PROMPTING);
      } else {
        // GUARDRAIL 1: Block if previous video is missing
        console.warn(`[Sequence] Cannot continue to extension index=${nextIndex}: previous shot (index=${nextIndex - 1}) has no video URI`);
        setErrorMessage(
          `Cannot continue sequence: Shot ${nextIndex} must be generated first.`
        );
      }
    }
  };

  const handleClearSequence = () => {
    // === P0.3 RESET: Complete purge of all sequence-related state ===
    console.log('[Reset] Clearing all sequence state (P0.3 full reset)');

    // Core sequence state
    setPromptSequence(null);
    setActivePromptIndex(null);
    setSequenceProgress(null);
    setSequenceVideoData({});
    setMainPromptConfig(null);
    setInitialFormValues(null);

    // Dogma binding (scoped to sequence + global selection)
    setSequenceBoundDogma(null);
    setActiveDogmaId(null); // Also clear user's global dogma selection

    // Storyboard / Nano Banana state
    setStoryboardByIndex({});
    setNanoEditorContext(null);
    setStoryboardModalContext(null);

    // Video extension state
    setOriginalVideoForExtension(null);
    setIsExternalVideoSource(false);

    // Assistant context (chat messages handled internally by component reset)
    setAssistantExtensionContext(null);
    setAssistantImage(null);
    setAssistantReferenceVideo(null);
    setAssistantMotionDescription(null);
    setMentionedCharacters([]);

    // Reset video display
    setVideoUrl(null);
    setLastVideoBlob(null);
    setLastVideoObject(null);
    setLastConfig(null);
    setIsCurrentVideoSaved(false);

    // Clear any editing state
    setEditingPromptDetails(null);
    setFrameToEdit(null);

    // Mode selection reset
    setSequenceMode('plan-sequence');

    // Return to initial stage
    setCurrentStage(AppStage.PROMPTING);
    setAppState(AppState.IDLE);
    setErrorMessage(null);
  };

  const handlePromptRevised = (newPrompt: string) => {
    if (lastConfig) {
      const newConfig = { ...lastConfig, prompt: newPrompt };
      setInitialFormValues(newConfig);
      setCurrentStage(AppStage.PROMPTING);
    }
  };

  const handleEditPromptFromSequence = (
    index: number,
    prompt: string,
    thumbnail?: string,
  ) => {
    setEditingPromptDetails({ index, prompt, thumbnail });
  };

  const handleConfirmPromptRevision = async (
    index: number,
    newPrompt: string,
  ) => {
    if (!promptSequence) return;

    // === RULE 1: Validate sequence context ===
    const effectiveDogma = sequenceBoundDogma; // Use sequence-bound, not global!
    if (!effectiveDogma && promptSequence.dogmaId) {
      console.error('[SequenceIntegrity] Lost dogma binding! Blocking revision.');
      setErrorMessage('Erreur de contexte: le dogma associé à cette séquence est introuvable.');
      return;
    }

    const allPrompts = [
      promptSequence.mainPrompt,
      ...promptSequence.extensionPrompts,
    ];
    allPrompts[index] = newPrompt;

    const isRootModified = index === 0;
    const extensionsCount = promptSequence.extensionPrompts.length;

    // === RULE 2: Root modified → Mark extensions dirty ===
    if (isRootModified && extensionsCount > 0) {
      console.log('[SequenceIntegrity] Root prompt modified, marking extensions dirty');

      const updatedSequence: PromptSequence = {
        ...promptSequence,
        mainPrompt: newPrompt,
        status: PromptSequenceStatus.ROOT_MODIFIED,
        // CRITICAL FIX: Extensions are indexed 1..N (root is 0)
        dirtyExtensions: Array.from({ length: extensionsCount }, (_, i) => i + 1),
        rootModifiedAt: new Date().toISOString(),
      };
      setPromptSequence(updatedSequence);
      setEditingPromptDetails(null);

      // Show user they need to regenerate extensions
      setErrorMessage(
        `⚠️ Le prompt racine a été modifié. Les ${extensionsCount} extension(s) doivent être régénérées.`
      );
      return; // Don't auto-regenerate - user must explicitly trigger
    }

    // Non-root modification: proceed with existing logic
    const newSequence: PromptSequence = {
      ...promptSequence,
      mainPrompt: allPrompts[0],
      extensionPrompts: allPrompts.slice(1),
    };
    setEditingPromptDetails(null);

    const promptsToRevise = allPrompts.slice(index + 1);
    if (promptsToRevise.length > 0) {
      setIsRevisingSequence({ fromIndex: index });
      try {
        const revisedFollowing = await reviseFollowingPrompts({
          dogma: effectiveDogma, // Use sequence-bound dogma!
          promptBefore: allPrompts[index - 1],
          editedPrompt: newPrompt,
          promptsToRevise,
        }, apiKey || undefined); // P0.7: BYOK as 2nd arg
        const finalPrompts = [
          ...allPrompts.slice(0, index + 1),
          ...revisedFollowing,
        ];
        const finalSequence: PromptSequence = {
          ...promptSequence,
          mainPrompt: finalPrompts[0],
          extensionPrompts: finalPrompts.slice(1),
          status: PromptSequenceStatus.CLEAN,
          dirtyExtensions: [],
        };
        setPromptSequence(finalSequence);
      } catch (e) {
        console.error('Failed to revise subsequent prompts', e);
        // Mark remaining extensions as dirty instead of failing
        const failedSequence: PromptSequence = {
          ...newSequence,
          status: PromptSequenceStatus.EXTENSIONS_DIRTY,
          dirtyExtensions: Array.from(
            { length: promptsToRevise.length },
            (_, i) => index + 1 + i
          ),
        };
        setPromptSequence(failedSequence);
      } finally {
        setIsRevisingSequence(null);
      }
    } else {
      setPromptSequence(newSequence);
    }
  };

  const handleStartExtensionAssistant = (lastFrame: ImageFile) => {
    if (!confirmUnsavedVideo()) return;

    const newConfig: GenerateVideoParams = {
      ...(lastConfig as GenerateVideoParams),
      prompt: '',
      mode: GenerationMode.EXTEND_VIDEO,
      inputVideoObject: lastVideoObject,
      startFrame: null,
      endFrame: null,
      referenceImages: [],
    };

    setInitialFormValues(newConfig);
    setAssistantExtensionContext(lastFrame);

    if (lastVideoBlob) {
      const originalVideoFile = new File([lastVideoBlob], 'original.mp4', {
        type: lastVideoBlob.type,
      });
      setOriginalVideoForExtension({
        file: originalVideoFile,
        base64: '',
      });
    }
    setIsExternalVideoSource(false); // Ensure internal extension doesn't trigger external flow

    setCurrentStage(AppStage.PROMPTING);
  };

  const handleStartExternalExtensionAssistant = (context: {
    lastFrame: ImageFile;
    motionDescription: string;
    originalVideo: File;
  }) => {
    if (!confirmUnsavedVideo()) return;
    setAssistantExtensionContext(context.lastFrame);
    setAssistantMotionDescription(context.motionDescription);
    setOriginalVideoForExtension({ file: context.originalVideo, base64: '' });
    setIsExternalVideoSource(true); // Mark as external source
    setCurrentStage(AppStage.PROMPTING);
    setInitialFormValues(null);
  };

  const { providerToken } = useAuth(); // Get provider token

  return (
    <ErrorBoundary>
      <div className="bg-[#121212] text-gray-100 h-screen flex overflow-hidden selection:bg-indigo-500/30">
        {/* SIDE NAVIGATION */}
        <nav className="w-16 bg-[#1e1e1e] border-r border-[#3f3f46] flex flex-col items-center py-4 shrink-0 z-30">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mb-8 shadow-lg shadow-indigo-600/30">J</div>
          <div className="flex flex-col space-y-6 w-full items-center">
            <button
              onClick={() => setActiveTab('conception')}
              className={`group flex flex-col items-center justify-center gap-1 w-full relative transition-all ${activeTab === 'conception' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {activeTab === 'conception' && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-600 rounded-r-full"></div>}
              <div className={`p-2 rounded-lg transition-colors ${activeTab === 'conception' ? 'bg-indigo-500/10' : 'group-hover:bg-gray-800'}`}>
                <span className="material-symbols-outlined text-2xl">design_services</span>
              </div>
              <span className="text-[9px] font-medium">Conception</span>
            </button>
            <button
              onClick={() => setActiveTab('editing')}
              className={`group flex flex-col items-center justify-center gap-1 w-full relative transition-all ${activeTab === 'editing' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {activeTab === 'editing' && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-600 rounded-r-full"></div>}
              <div className={`p-2 rounded-lg transition-colors ${activeTab === 'editing' ? 'bg-indigo-500/10' : 'group-hover:bg-gray-800'}`}>
                <span className="material-symbols-outlined text-2xl">movie_edit</span>
              </div>
              <span className="text-[9px] font-medium">Editing</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`group flex flex-col items-center justify-center gap-1 w-full relative transition-all ${activeTab === 'export' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {activeTab === 'export' && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-600 rounded-r-full"></div>}
              <div className={`p-2 rounded-lg transition-colors ${activeTab === 'export' ? 'bg-indigo-500/10' : 'group-hover:bg-gray-800'}`}>
                <span className="material-symbols-outlined text-2xl">high_quality</span>
              </div>
              <span className="text-[9px] font-medium">Upscale</span>
            </button>
          </div>
          <div className="mt-auto flex flex-col space-y-4 items-center mb-4">
            <button
              onClick={() => setShowApiKeyDialog(true)}
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-all"
              title="Settings"
            >
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-medium shadow-md text-xs cursor-pointer hover:scale-105 transition-transform">JK</div>
          </div>
        </nav>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <main className="flex-grow p-4 overflow-hidden">
            <div className="w-full h-full mx-auto">
              {appState === AppState.LOADING && (
                <div className="w-full h-full flex items-center justify-center">
                  <LoadingIndicator onCancel={handleCancelGeneration} />
                </div>
              )}
              {appState === AppState.ERROR && (
                <div className="w-full h-full flex items-center justify-center text-center">
                  <div>
                    <h2 className="text-2xl font-bold text-red-400 mb-4">
                      An Error Occurred
                    </h2>
                    <p className="text-gray-300 bg-red-900/50 p-4 rounded-lg max-w-lg mx-auto">
                      {errorMessage}
                    </p>
                    <button
                      onClick={handleRetryLastPrompt}
                      className="mt-6 flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                      <SparklesIcon className="w-5 h-5" />
                      Try Again
                    </button>
                  </div>
                </div>
              )}
              {appState !== AppState.LOADING && appState !== AppState.ERROR && (
                <div className="w-full h-full">
                  {/* TAB CONTENT: CONCEPTION */}
                  {activeTab === 'conception' && (
                    <div className="w-full h-full p-4">
                      {currentStage === AppStage.PROMPTING && (
                        <div className="grid grid-cols-3 gap-4 h-full">
                          <div className="col-span-2 h-full">
                            <PromptSequenceAssistant
                              onSequenceGenerated={handleSequenceGenerated}
                              activeDogma={activeDogma}
                              onOpenDogmaManager={() => setIsDogmaManagerOpen(true)}
                              onOpenCharacterManager={() =>
                                setIsCharacterManagerOpen(true)
                              }
                              initialValues={initialFormValues}
                              onGenerate={handleGenerate}
                              extensionContext={assistantExtensionContext}
                              onStartExternalExtensionAssistant={
                                handleStartExternalExtensionAssistant
                              }
                              onClearContext={handleStartNewProject}
                              assistantImage={assistantImage}
                              onAssistantImageChange={setAssistantImage}
                              assistantReferenceVideo={assistantReferenceVideo}
                              videoForExtension={lastVideoObject}
                              characterToInject={characterToInject}
                              onCharacterInjected={() => setCharacterToInject(null)}
                              characters={characters}
                              onMentionedCharactersChange={setMentionedCharacters}
                              motionDescription={assistantMotionDescription}
                              onProvisionalSequence={handleProvisionalSequence}
                              apiKey={apiKey} // P0.6: Pass API Key
                              // P0: Persistence
                              messages={assistantMessages}
                              onMessagesChange={setAssistantMessages}
                              sequenceMode={sequenceMode}
                              onSequenceModeChange={handleSequenceModeChange}
                            />
                          </div>
                          <div className="col-span-1 h-full max-h-[calc(100vh-160px)] overflow-auto">
                            {promptSequence ? (
                              <SequenceManager
                                sequence={promptSequence}
                                activePromptIndex={activePromptIndex}
                                onSelectPrompt={handleSelectPromptFromSequence}
                                onClearSequence={handleClearSequence}
                                onEditRequest={handleEditPromptFromSequence}
                                revisingFromIndex={
                                  isRevisingSequence?.fromIndex ?? null
                                }
                                videoData={sequenceVideoData}
                                storyboardByIndex={storyboardByIndex}
                                onThumbnailClick={async (thumbnailBase64, index) => {
                                  // Get prompt for this segment
                                  const prompt = index === 0
                                    ? promptSequence.mainPrompt
                                    : promptSequence.extensionPrompts[index - 1] || '';

                                  // If we have an image, open Nano editor for retouching
                                  const existingImage = thumbnailBase64
                                    ? { file: base64ToFile(thumbnailBase64, `keyframe_${index}.png`, 'image/png'), base64: thumbnailBase64 }
                                    : storyboardByIndex[index]?.previewImage;

                                  if (existingImage) {
                                    openNanoEditor({ segmentIndex: index, baseImage: existingImage, initialPrompt: prompt });
                                  } else {
                                    // No image - generate a new preview
                                    console.log(`[ImageFirst] Generating preview for segment ${index}`);
                                    try {
                                      const result = await generateNanoPreview({
                                        textPrompt: prompt,
                                        dogma: sequenceBoundDogma,
                                        quality: 'pro', // Single shot generation = Pro
                                        target: index === 0 ? 'root' : 'extension',
                                        apiKey: apiKey || undefined,
                                      });
                                      if (result.previewImage) {
                                        setStoryboardByIndex(prev => ({
                                          ...prev,
                                          [index]: {
                                            id: crypto.randomUUID(),
                                            owner: index === 0 ? 'root' : 'extension',
                                            previewImage: result.previewImage,
                                            previewPrompt: result.previewPrompt || prompt,
                                            segmentIndex: index,
                                            cameraNotes: result.cameraNotes,
                                            movementNotes: result.movementNotes,
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString(),
                                          }
                                        }));
                                        console.log(`[ImageFirst] Preview generated for segment ${index}`);
                                      }
                                    } catch (err) {
                                      console.error(`[ImageFirst] Failed to generate preview:`, err);
                                      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate preview.');
                                    }
                                  }
                                }}
                                // P2.4: Regenerate keyframe action
                                onRegenerateKeyframe={async (segmentIndex) => {
                                  console.log(`[ImageFirst] Regenerating keyframe for segment ${segmentIndex}`);
                                  const prompt = segmentIndex === 0
                                    ? promptSequence.mainPrompt
                                    : promptSequence.extensionPrompts[segmentIndex - 1] || '';
                                  try {
                                    const result = await generateNanoPreview({
                                      textPrompt: prompt,
                                      dogma: sequenceBoundDogma,
                                      quality: 'pro', // Single shot regeneration = Pro
                                      target: segmentIndex === 0 ? 'root' : 'extension',
                                      apiKey: apiKey || undefined,
                                    });
                                    if (result.previewImage) {
                                      setStoryboardByIndex(prev => ({
                                        ...prev,
                                        [segmentIndex]: {
                                          id: crypto.randomUUID(),
                                          owner: segmentIndex === 0 ? 'root' : 'extension',
                                          previewImage: result.previewImage,
                                          previewPrompt: result.previewPrompt || prompt,
                                          segmentIndex,
                                          cameraNotes: result.cameraNotes,
                                          movementNotes: result.movementNotes,
                                          createdAt: new Date().toISOString(),
                                          updatedAt: new Date().toISOString(),
                                        }
                                      }));
                                    }
                                  } catch (err) {
                                    console.error(`[ImageFirst] Regenerate failed:`, err);
                                    setErrorMessage(err instanceof Error ? err.message : 'Failed to regenerate keyframe.');
                                  }
                                }}
                                // P2.4: Use keyframe as base image for video generation
                                onUseKeyframeAsBase={(segmentIndex, image) => {
                                  console.log(`[ImageFirst] Using keyframe ${segmentIndex} as base`);
                                  const imageFile: ImageFile = {
                                    file: base64ToFile(image.base64, `keyframe_${segmentIndex}.png`, 'image/png'),
                                    base64: image.base64,
                                  };
                                  setAssistantImage(imageFile);
                                  // Set the prompt as active
                                  const prompt = segmentIndex === 0
                                    ? promptSequence.mainPrompt
                                    : promptSequence.extensionPrompts[segmentIndex - 1] || '';
                                  setActivePromptIndex(segmentIndex);
                                  setInitialFormValues(prev => prev ? { ...prev, prompt } : null);
                                }}
                              />
                            ) : (
                              <PromptConception
                                apiKey={apiKey} // P0.6: Pass local API key
                                key={resetKey} // Force remount on new project to clear assistant context
                                motionDescription={assistantMotionDescription}
                                referenceImage={assistantExtensionContext}
                                activeChatImage={assistantImage}
                                mentionedCharacters={mentionedCharacters}
                                // Sequence history must be numerically sorted by segment index
                                sequenceHistory={sortedSequenceHistory}
                                // Nano Banana Pro: Thumbnail Retouche
                                onOpenNanoEditor={(segmentIndex, baseImage, initialPrompt) => {
                                  openNanoEditor({ segmentIndex, baseImage, initialPrompt });
                                }}
                                promptSequence={promptSequence}
                                storyboardByIndex={storyboardByIndex}
                                isGeneratingKeyframes={isGeneratingKeyframes}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {currentStage === AppStage.RESULT && videoUrl && (
                        <VideoResult
                          videoUrl={videoUrl}
                          lastConfig={lastConfig}
                          onRetry={handleRetryLastPrompt}
                          onStartNewProject={handleStartNewProject}
                          onExtendVideo={handleExtendVideo}
                          canExtend={lastConfig?.model !== VeoModel.VEO}
                          onContinueFromFrame={handleContinueFromFrame}
                          onEditCapturedFrame={handleEditCapturedFrame}
                          sequenceProgress={sequenceProgress}
                          onSaveShot={handleSaveShot}
                          onContinueSequence={handleContinueSequence}
                          originalVideoForExtension={originalVideoForExtension}
                          onStartExtensionAssistant={handleStartExtensionAssistant}
                          activeDogma={activeDogma}
                          onPromptRevised={handlePromptRevised}
                          // Nano Banana Pro: Drift Control
                          onRecalNano={(segmentIndex, baseImage, initialPrompt) => {
                            openNanoEditor({ segmentIndex, baseImage, initialPrompt });
                          }}
                          promptSequence={promptSequence}
                          activePromptIndex={activePromptIndex}
                        />
                      )}
                      {currentStage === AppStage.EDITING && frameToEdit && (
                        <div className="grid grid-cols-3 gap-4 h-full">
                          <div className="col-span-2 h-full">
                            <AIEditorModal
                              image={frameToEdit}
                              onClose={() => setCurrentStage(AppStage.RESULT)}
                              onConfirm={handleFrameEditConfirm}
                              dogma={activeDogma}
                            />
                          </div>
                          <div className="col-span-1 h-full">
                            <VisualContextViewer
                              image={frameToEdit}
                              stage={currentStage}
                              onEditRequest={() => {
                                /* Already in editor */
                              }}
                              onApplyNano={handleApplyNano}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB CONTENT: EDITING (Timeline) */}
                  {activeTab === 'editing' && (
                    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#121212]">
                      <div className="flex-1 flex min-h-0">
                        {/* ASIDE: Bin Manager */}
                        <BinManager
                          onMediaSelect={(media) => setSourceMedia(media)}
                          onAddToTimeline={(media) => {
                            console.log('[Studio] Add to timeline:', media.name);

                            // AUTO-FPS: If timeline is empty, set project FPS to match first clip
                            const currentSegments = timelineState.segments;
                            if (currentSegments.length === 0 && media.metadata?.fps) {
                              const rawFps = media.metadata.fps;
                              // Map to supported FPS (24, 25, 30)
                              let newFps: import('./types/timeline').FPS = 25;
                              if (Math.abs(rawFps - 24) < 1 || Math.abs(rawFps - 23.976) < 1) newFps = 24;
                              if (Math.abs(rawFps - 30) < 1 || Math.abs(rawFps - 29.97) < 1) newFps = 30;

                              console.log(`[Studio] Auto-FPS: Setting project FPS to ${newFps} (from ${rawFps})`);

                              setTimelineState(prev => ({
                                ...prev,
                                project: prev.project ? { ...prev.project, fps: newFps } : null
                              }));

                              // Update engine immediately
                              engine?.setFps(newFps);
                            }

                            const fps = timelineState.project?.fps || 25;
                            const playheadPos = timelineState.playheadSec;
                            const timestamp = Date.now();
                            const segId = `seg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

                            // Calculate proper duration using frames if available, else seconds
                            const durationSec = media.durationSec || 5;
                            const durationFrames = media.metadata?.totalFrames || Math.round(durationSec * fps);

                            const newSegment: import('./types/timeline').SegmentWithUI = {
                              id: `${segId}_v`,
                              projectId: timelineState.project?.id || 'local',
                              trackId: 'v1',
                              order: currentSegments.filter(s => s.trackId === 'v1').length,
                              inSec: playheadPos,
                              outSec: playheadPos + durationSec,
                              durationSec: durationSec,
                              startFrame: Math.round(playheadPos * fps),
                              durationFrames: durationFrames,

                              label: media.name,
                              locked: false,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                              uiState: 'idle',

                              // Source linking
                              mediaKind: 'rush',
                              mediaId: media.id,
                              mediaType: media.type as 'video' | 'image',
                              sourceStartFrame: 0,
                              sourceDurationFrames: durationFrames,
                              sourceInSec: 0,
                              sourceOutSec: durationSec,
                              sourceDurationSec: durationSec
                            };

                            setTimelineState(prev => ({
                              ...prev,
                              segments: [...prev.segments, newSegment]
                            }));
                          }}
                        />

                        {/* MAIN: Player Area or Source Viewer */}
                        {sourceMedia ? (
                          <SourceViewer
                            media={sourceMedia}
                            onClose={() => setSourceMedia(null)}
                            onInsert={(media, inPoint, outPoint) => {
                              const clipDuration = outPoint - inPoint;
                              const playheadPos = timelineState.playheadSec;
                              const timestamp = Date.now();
                              const segId = `seg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                              const linkGroupId = `link_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

                              console.log(`[Studio] INSERT at ${playheadPos.toFixed(2)}s: ${media.name} (${clipDuration.toFixed(2)}s)`);

                              // Create VIDEO segment on V1
                              const videoSegment: import('./types/timeline').SegmentWithUI = {
                                id: `${segId}_v`,
                                projectId: timelineState.project?.id || 'local',
                                trackId: 'v1',
                                order: timelineState.segments.filter(s => s.trackId === 'v1').length,
                                inSec: playheadPos,
                                outSec: playheadPos + clipDuration,
                                durationSec: clipDuration,
                                locked: false,
                                label: media.name.replace(/\.[^/.]+$/, ''),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                uiState: 'idle',
                                // Rush media source
                                mediaKind: 'rush',
                                mediaSrc: media.localUrl,
                                sourceInSec: inPoint,
                                sourceOutSec: outPoint,
                                // Linked clips (Premiere Pro paradigm)
                                linkGroupId,
                                mediaType: 'video',
                                activeRevision: {
                                  id: `rev_${timestamp}_v`,
                                  segmentId: `${segId}_v`,
                                  videoUrl: media.localUrl,
                                  thumbnailUrl: media.thumbnail || '',
                                  status: 'succeeded',
                                  createdAt: new Date().toISOString()
                                }
                              };

                              // Create AUDIO segment on A1 (same timing, same linkGroupId)
                              const audioSegment: import('./types/timeline').SegmentWithUI = {
                                id: `${segId}_a`,
                                projectId: timelineState.project?.id || 'local',
                                trackId: 'a1',
                                order: timelineState.segments.filter(s => s.trackId === 'a1').length,
                                inSec: playheadPos,
                                outSec: playheadPos + clipDuration,
                                durationSec: clipDuration,
                                locked: false,
                                label: `${media.name.replace(/\.[^/.]+$/, '')} (Audio)`,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                uiState: 'idle',
                                // Rush media source (audio from same file)
                                mediaKind: 'rush',
                                mediaSrc: media.localUrl,
                                sourceInSec: inPoint,
                                sourceOutSec: outPoint,
                                // Linked clips (Premiere Pro paradigm)
                                linkGroupId,
                                mediaType: 'audio'
                              };

                              // TRUE INSERT MODE: Split overlapping segments, then shift all following
                              setTimelineState(prev => {
                                const processedSegments: typeof prev.segments = [];

                                for (const seg of prev.segments) {
                                  // Only process V1 and A1 segments
                                  if (seg.trackId !== 'v1' && seg.trackId !== 'a1') {
                                    processedSegments.push(seg);
                                    continue;
                                  }

                                  // Case 1: Segment is completely before insertion point - keep as is
                                  if (seg.outSec <= playheadPos) {
                                    processedSegments.push(seg);
                                    continue;
                                  }

                                  // Case 2: Segment starts at or after insertion point - shift right
                                  if (seg.inSec >= playheadPos) {
                                    processedSegments.push({
                                      ...seg,
                                      inSec: seg.inSec + clipDuration,
                                      outSec: seg.outSec + clipDuration
                                    });
                                    continue;
                                  }

                                  // Case 3: Segment OVERLAPS insertion point - split into two parts
                                  if (seg.inSec < playheadPos && seg.outSec > playheadPos) {
                                    // Left part: keep in place (before insertion)
                                    const leftDuration = playheadPos - seg.inSec;
                                    const leftPart = {
                                      ...seg,
                                      id: seg.id + '_left',
                                      outSec: playheadPos,
                                      durationSec: leftDuration,
                                      sourceOutSec: (seg.sourceInSec ?? 0) + leftDuration
                                    };

                                    // Right part: shift right (after new clip)
                                    const rightStart = playheadPos + clipDuration;
                                    const rightPart = {
                                      ...seg,
                                      id: seg.id + '_right',
                                      inSec: rightStart,
                                      outSec: rightStart + (seg.outSec - playheadPos),
                                      durationSec: seg.outSec - playheadPos,
                                      sourceInSec: (seg.sourceInSec ?? 0) + leftDuration
                                    };

                                    console.log(`[INSERT] Split segment ${seg.id} at ${playheadPos}s`);
                                    processedSegments.push(leftPart, rightPart);
                                    continue;
                                  }

                                  // Fallback
                                  processedSegments.push(seg);
                                }

                                return {
                                  ...prev,
                                  segments: [...processedSegments, videoSegment, audioSegment],
                                  selectedSegmentIds: [videoSegment.id, audioSegment.id],
                                  playheadSec: playheadPos + clipDuration
                                };
                              });

                              console.log(`[Studio] INSERT: Created V1+A1: ${videoSegment.id}, ${audioSegment.id} at ${playheadPos}s`);
                              setSourceMedia(null);
                            }}
                            onOverwrite={(media, inPoint, outPoint) => {
                              const clipDuration = outPoint - inPoint;
                              const playheadPos = timelineState.playheadSec;
                              const timestamp = Date.now();
                              const segId = `seg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
                              const linkGroupId = `link_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

                              console.log(`[Studio] OVERWRITE at ${playheadPos.toFixed(2)}s: ${media.name} (${clipDuration.toFixed(2)}s)`);

                              // Create VIDEO segment on V1
                              const videoSegment: import('./types/timeline').SegmentWithUI = {
                                id: `${segId}_v`,
                                projectId: timelineState.project?.id || 'local',
                                trackId: 'v1',
                                order: timelineState.segments.filter(s => s.trackId === 'v1').length,
                                inSec: playheadPos,
                                outSec: playheadPos + clipDuration,
                                durationSec: clipDuration,
                                locked: false,
                                label: media.name.replace(/\.[^/.]+$/, ''),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                uiState: 'idle',
                                mediaKind: 'rush',
                                mediaSrc: media.localUrl,
                                sourceInSec: inPoint,
                                sourceOutSec: outPoint,
                                // Linked clips (Premiere Pro paradigm)
                                linkGroupId,
                                mediaType: 'video',
                                activeRevision: {
                                  id: `rev_${timestamp}_v`,
                                  segmentId: `${segId}_v`,
                                  videoUrl: media.localUrl,
                                  thumbnailUrl: media.thumbnail || '',
                                  status: 'succeeded',
                                  createdAt: new Date().toISOString()
                                }
                              };

                              // Create AUDIO segment on A1 (same linkGroupId)
                              const audioSegment: import('./types/timeline').SegmentWithUI = {
                                id: `${segId}_a`,
                                projectId: timelineState.project?.id || 'local',
                                trackId: 'a1',
                                order: timelineState.segments.filter(s => s.trackId === 'a1').length,
                                inSec: playheadPos,
                                outSec: playheadPos + clipDuration,
                                durationSec: clipDuration,
                                locked: false,
                                label: `${media.name.replace(/\.[^/.]+$/, '')} (Audio)`,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                uiState: 'idle',
                                mediaKind: 'rush',
                                mediaSrc: media.localUrl,
                                sourceInSec: inPoint,
                                sourceOutSec: outPoint,
                                // Linked clips (Premiere Pro paradigm)
                                linkGroupId,
                                mediaType: 'audio'
                              };

                              // TRUE OVERWRITE MODE: Handle overlapping segments
                              setTimelineState(prev => {
                                const newInSec = playheadPos;
                                const newOutSec = playheadPos + clipDuration;
                                const processedSegments: typeof prev.segments = [];

                                for (const seg of prev.segments) {
                                  // Only process V1 and A1 segments (the tracks we're overwriting)
                                  if (seg.trackId !== 'v1' && seg.trackId !== 'a1') {
                                    processedSegments.push(seg);
                                    continue;
                                  }

                                  const segInSec = seg.inSec;
                                  const segOutSec = seg.outSec;

                                  // Case 1: Segment completely before new clip - keep as is
                                  if (segOutSec <= newInSec) {
                                    processedSegments.push(seg);
                                    continue;
                                  }

                                  // Case 2: Segment completely after new clip - keep as is
                                  if (segInSec >= newOutSec) {
                                    processedSegments.push(seg);
                                    continue;
                                  }

                                  // Case 3: Segment completely covered by new clip - remove it
                                  if (segInSec >= newInSec && segOutSec <= newOutSec) {
                                    console.log(`[OVERWRITE] Removing fully covered segment: ${seg.id}`);
                                    continue; // Skip this segment
                                  }

                                  // Case 4: New clip covers start of segment - trim left side
                                  if (segInSec >= newInSec && segInSec < newOutSec && segOutSec > newOutSec) {
                                    const trimmedSeg = {
                                      ...seg,
                                      inSec: newOutSec,
                                      durationSec: segOutSec - newOutSec,
                                      sourceInSec: (seg.sourceInSec ?? 0) + (newOutSec - segInSec)
                                    };
                                    console.log(`[OVERWRITE] Trimming left of segment: ${seg.id}`);
                                    processedSegments.push(trimmedSeg);
                                    continue;
                                  }

                                  // Case 5: New clip covers end of segment - trim right side
                                  if (segInSec < newInSec && segOutSec > newInSec && segOutSec <= newOutSec) {
                                    const trimmedSeg = {
                                      ...seg,
                                      outSec: newInSec,
                                      durationSec: newInSec - segInSec,
                                      sourceOutSec: (seg.sourceInSec ?? 0) + (newInSec - segInSec)
                                    };
                                    console.log(`[OVERWRITE] Trimming right of segment: ${seg.id}`);
                                    processedSegments.push(trimmedSeg);
                                    continue;
                                  }

                                  // Case 6: New clip is in middle of segment - split into two
                                  if (segInSec < newInSec && segOutSec > newOutSec) {
                                    const leftPart = {
                                      ...seg,
                                      id: seg.id + '_left',
                                      outSec: newInSec,
                                      durationSec: newInSec - segInSec,
                                      sourceOutSec: (seg.sourceInSec ?? 0) + (newInSec - segInSec)
                                    };
                                    const rightPart = {
                                      ...seg,
                                      id: seg.id + '_right',
                                      inSec: newOutSec,
                                      durationSec: segOutSec - newOutSec,
                                      sourceInSec: (seg.sourceInSec ?? 0) + (newOutSec - segInSec)
                                    };
                                    console.log(`[OVERWRITE] Splitting segment: ${seg.id} into left and right`);
                                    processedSegments.push(leftPart, rightPart);
                                    continue;
                                  }

                                  // Fallback - keep segment
                                  processedSegments.push(seg);
                                }

                                return {
                                  ...prev,
                                  segments: [...processedSegments, videoSegment, audioSegment],
                                  selectedSegmentIds: [videoSegment.id, audioSegment.id],
                                  playheadSec: playheadPos + clipDuration
                                };
                              });

                              console.log(`[Studio] OVERWRITE: Created V1+A1: ${videoSegment.id}, ${audioSegment.id}`);
                              setSourceMedia(null);
                            }}
                          />
                        ) : (
                          <TimelinePreview
                            tracks={timelineState.tracks}
                            segments={timelineState.segments}
                            playheadSec={timelineState.playheadSec}
                            isPlaying={isPlaying}
                            onPlayPause={togglePlayPause}
                            onSeek={(sec) => {
                              seek(sec);
                              // Immediate local update for responsiveness
                              setTimelineState(prev => ({ ...prev, playheadSec: sec }));
                            }}
                            fps={timelineState.project?.fps || 25}
                          />
                        )}

                        {/* ASIDE: Vertical Stack & IA Panel */}
                        <aside className="w-[380px] bg-[#1e1e1e] flex flex-col shrink-0">
                          <div className="flex-1 flex flex-col min-h-0 border-b border-[#3f3f46]">
                            <div className="h-10 border-b border-[#3f3f46] flex items-center justify-between px-3 bg-[#1a1a1a] shrink-0">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-gray-400 text-sm">view_timeline</span>
                                <span className="font-semibold text-[10px] text-gray-200 uppercase tracking-widest">Vertical Timeline Stack</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm text-gray-500 cursor-pointer hover:text-white">north</span>
                                <span className="material-symbols-outlined text-sm text-gray-400 cursor-pointer hover:text-white">south</span>
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 bg-[#121212]">
                              <VerticalTimelineStack
                                segments={timelineState.segments}
                                selectedSegmentIds={timelineState.selectedSegmentIds}
                                expandedSegmentIds={timelineState.expandedSegmentIds}
                                onSegmentClick={(id) => setTimelineState(s => ({ ...s, selectedSegmentIds: [id] }))}
                                onSegmentExpand={(id) => setTimelineState(s => ({ ...s, expandedSegmentIds: [...s.expandedSegmentIds, id] }))}
                                onSegmentCollapse={(id) => setTimelineState(s => ({ ...s, expandedSegmentIds: s.expandedSegmentIds.filter(x => x !== id) }))}
                                onIterationClick={() => { }}
                                onIterationValidate={() => { }}
                                onIterationDelete={() => { }}
                                onSegmentLock={() => { }}
                                onSegmentUnlock={() => { }}
                                onReprompt={() => { }}
                                onReorder={handleSegmentReorder}
                                onSegmentDelete={handleSegmentDelete}
                                onSegmentDuplicate={handleSegmentDuplicate}
                              />
                            </div>
                          </div>
                          {/* IA Panel */}
                          <div className="h-[380px] bg-[#2a2a2a] flex flex-col shrink-0 border-t border-[#3f3f46] shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-10">
                            <SegmentIAPanel
                              activeTab={iaPanelTab}
                              onTabChange={setIaPanelTab}
                              segment={timelineState.segments.find(s => timelineState.selectedSegmentIds.includes(s.id)) || null}
                              activeRevision={null}
                              onReprompt={() => { }}
                              onRegenerate={() => { }}
                            />
                          </div>
                        </aside>
                      </div>

                      {/* BOTTOM: Horizontal Timeline */}
                      <HorizontalTimeline
                        tracks={timelineState.tracks}
                        segments={timelineState.segments}
                        selectedSegmentIds={timelineState.selectedSegmentIds}
                        selectedTrackId={timelineState.selectedTrackId}
                        playheadSec={timelineState.playheadSec}
                        fps={timelineState.project?.fps || 25}
                        onPlayheadChange={(sec) => {
                          seek(sec);
                          setTimelineState(s => ({ ...s, playheadSec: sec }));
                        }}
                        onSegmentClick={(id) => setTimelineState(s => ({ ...s, selectedSegmentIds: [id] }))}
                        onSegmentDoubleClick={(id) => setTimelineState(s => ({ ...s, expandedSegmentIds: [...s.expandedSegmentIds, id] }))}
                        onTrackSelect={(trackId) => setTimelineState(s => ({ ...s, selectedTrackId: trackId }))}
                        onSegmentTrim={(segmentId, edge, newTime) => {
                          const fps = timelineState.project?.fps || 25;
                          // SNAP: Round newTime to nearest frame
                          const snappedTime = Math.round(newTime * fps) / fps;

                          pushToHistory();
                          setTimelineState(s => ({
                            ...s,
                            segments: s.segments.map(seg => {
                              if (seg.id !== segmentId) return seg;
                              if (edge === 'start') {
                                const newDuration = seg.outSec - snappedTime;
                                const newStartFrame = Math.round(snappedTime * fps);
                                const newDurFrames = Math.round(newDuration * fps);
                                return {
                                  ...seg,
                                  inSec: snappedTime,
                                  durationSec: newDuration,
                                  startFrame: newStartFrame,
                                  durationFrames: newDurFrames
                                };
                              } else {
                                const newDuration = snappedTime - seg.inSec;
                                const newDurFrames = Math.round(newDuration * fps);
                                return {
                                  ...seg,
                                  outSec: snappedTime,
                                  durationSec: newDuration,
                                  durationFrames: newDurFrames
                                };
                              }
                            })
                          }));
                        }}
                        onSegmentMove={(segmentId, newInSec) => {
                          const fps = timelineState.project?.fps || 25;
                          // SNAP: Round to nearest frame
                          const snappedIn = Math.round(newInSec * fps) / fps;

                          pushToHistory();
                          setTimelineState(s => ({
                            ...s,
                            segments: s.segments.map(seg => {
                              if (seg.id !== segmentId) return seg;
                              const duration = seg.outSec - seg.inSec;
                              const durationFrames = seg.durationFrames || Math.round(duration * fps);

                              const newOut = snappedIn + duration;
                              const newStartFrame = Math.round(snappedIn * fps);

                              return {
                                ...seg,
                                inSec: snappedIn,
                                outSec: newOut,
                                startFrame: newStartFrame
                              };
                            })
                          }));
                        }}
                        onDeleteGap={(atSec, trackId) => {
                          pushToHistory();
                          // Ripple: shift all segments after the gap to close it
                          const trackSegments = timelineState.segments
                            .filter(s => s.trackId === trackId)
                            .sort((a, b) => a.inSec - b.inSec);

                          // Find gap at atSec
                          let gapStart = 0;
                          let gapEnd = atSec;
                          for (const seg of trackSegments) {
                            if (seg.inSec > gapStart && seg.inSec <= atSec) {
                              gapStart = seg.outSec;
                            }
                            if (seg.inSec > atSec) {
                              gapEnd = seg.inSec;
                              break;
                            }
                          }
                          const gapDuration = gapEnd - gapStart;

                          if (gapDuration > 0) {
                            setTimelineState(s => ({
                              ...s,
                              segments: s.segments.map(seg => {
                                if (seg.trackId === trackId && seg.inSec >= gapEnd) {
                                  return {
                                    ...seg,
                                    inSec: seg.inSec - gapDuration,
                                    outSec: seg.outSec - gapDuration
                                  };
                                }
                                return seg;
                              })
                            }));
                          }
                        }}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onCut={() => {
                          const segmentAtPlayhead = timelineState.segments.find(s =>
                            timelineState.playheadSec > s.inSec && timelineState.playheadSec < s.outSec
                          );
                          if (segmentAtPlayhead) {
                            handleSplitSegment(segmentAtPlayhead.id, timelineState.playheadSec);
                          }
                        }}
                        onRippleDelete={() => {
                          const id = timelineState.selectedSegmentIds[0];
                          if (id) handleSegmentDelete(id);
                        }}
                        onExport={() => setIsExportDialogOpen(true)}
                        onSaveJson={handleSaveProjectJson}
                        onLoadJson={() => fileInputRef.current?.click()}
                        canUndo={historyRef.current.past.length > 0}
                        canRedo={historyRef.current.future.length > 0}
                        className="h-48 shrink-0"
                      />

                      {/* Hidden Input for JSON Load */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".json"
                        onChange={handleLoadProjectJson}
                      />
                    </div>
                  )}

                  {/* TAB CONTENT: EXPORT */}
                  {activeTab === 'export' && (
                    <div className="w-full h-full p-12 flex flex-col items-center justify-center text-center bg-[#121212]">
                      <div className="max-w-lg w-full bg-[#1a1a1a] border border-gray-800 p-12 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
                        <div className="w-24 h-24 bg-indigo-600/10 rounded-3xl flex items-center justify-center mx-auto mb-10 rotate-3 hover:rotate-0 transition-transform duration-500">
                          <UploadCloudIcon className="w-12 h-12 text-indigo-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Prêt pour l'Export ?</h2>
                        <p className="text-gray-500 text-base mb-12 max-w-sm mx-auto leading-relaxed">Finalisez votre montage et exportez les métadonnées pour vos outils de post-production.</p>
                        <div className="grid gap-4">
                          <button
                            onClick={() => setIsExportDialogOpen(true)}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all font-bold text-lg group"
                          >
                            <SparklesIcon className="w-6 h-6 group-hover:animate-sparkle" />
                            <span>Exporter le MP4 (Final)</span>
                          </button>
                          <button
                            onClick={handleSaveProjectJson}
                            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-3xl border border-gray-700 font-medium text-sm"
                          >
                            Sauvegarder le Projet (.json)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* GLOBAL DIALOGS */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        segments={timelineState.segments}
      />

      {/* API KEY DIALOG (BYOK) */}
      {showApiKeyDialog && (
        <ApiKeyDialog
          onSetKey={(key) => {
            setApiKey(key);
            setRuntimeApiKey(key);
            setHasCustomKey(true);
            setShowApiKeyDialog(false);
          }}
          onClearKey={() => {
            setApiKey(null);
            setRuntimeApiKey(null);
            setHasCustomKey(false);
          }}
          onClose={() => setShowApiKeyDialog(false)}
          hasCustomKey={hasCustomKey}
          providerToken={providerToken}
        />
      )}

      {/* DOGMA MANAGER */}
      {isDogmaManagerOpen && (
        <DogmaManager
          isOpen={isDogmaManagerOpen}
          dogmas={dogmas}
          onSaveDogma={(dogma) => {
            if (dogma.id) {
              setDogmas(prev => prev.map(d => d.id === dogma.id ? { ...d, ...dogma } as Dogma : d));
            } else {
              const newDogma: Dogma = { ...dogma, id: crypto.randomUUID() } as Dogma;
              setDogmas(prev => [...prev, newDogma]);
            }
          }}
          onDeleteDogma={(dogmaId) => {
            setDogmas(prev => prev.filter(d => d.id !== dogmaId));
            if (activeDogmaId === dogmaId) setActiveDogmaId(null);
          }}
          activeDogmaId={activeDogmaId}
          onSetActiveDogmaId={setActiveDogmaId}
          onClose={() => setIsDogmaManagerOpen(false)}
        />
      )}

      {/* CHARACTER MANAGER */}
      {isCharacterManagerOpen && (
        <CharacterManager
          isOpen={isCharacterManagerOpen}
          characters={characters}
          onSaveCharacter={(character) => {
            if (character.id) {
              setCharacters(prev => prev.map(c => c.id === character.id ? { ...c, ...character } as Character : c));
            } else {
              const newChar: Character = { ...character, id: crypto.randomUUID() } as Character;
              setCharacters(prev => [...prev, newChar]);
            }
          }}
          onDeleteCharacter={(charId) => setCharacters(prev => prev.filter(c => c.id !== charId))}
          onClose={() => setIsCharacterManagerOpen(false)}
          onUseCharacter={setCharacterToInject}
        />
      )}

      {/* SHOT LIBRARY */}
      {isShotLibraryOpen && (
        <ShotLibrary
          isOpen={isShotLibraryOpen}
          shots={savedShots}
          onClose={() => setIsShotLibraryOpen(false)}
          onDeleteShot={handleDeleteShot}
          onUpdateShotTitle={handleUpdateShotTitle}
          onLoadShot={(shot) => {
            console.log('[ShotLibrary] Loading shot:', shot.id);
            setIsShotLibraryOpen(false);
          }}
        />
      )}

      {/* STORYBOARD PREVIEW MODAL (12 Grid Shots) */}
      {storyboardModalContext && (
        <StoryboardPreviewModal
          isOpen={true}
          onClose={() => setStoryboardModalContext(null)}
          onApplyVariant={(payload: NanoApplyPayload) => {
            // Apply single variant to storyboard
            if (payload.previewImage) {
              setStoryboardByIndex(prev => ({
                ...prev,
                [storyboardModalContext.segmentIndex]: {
                  id: crypto.randomUUID(),
                  owner: 'root',
                  segmentIndex: storyboardModalContext.segmentIndex,
                  previewImage: payload.previewImage,
                  previewPrompt: payload.previewPrompt || storyboardModalContext.currentPrompt,
                  cameraNotes: payload.cameraNotes,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              }));
            }
            setStoryboardModalContext(null);
          }}
          segmentIndex={storyboardModalContext.segmentIndex}
          baseImage={storyboardModalContext.baseImage}
          currentPrompt={storyboardModalContext.currentPrompt}
          dogma={sequenceBoundDogma ?? activeDogma}
          mode={storyboardModalContext.mode}
          onBuildTimeline={(shots) => {
            // Create a sequence bin from ordered shots
            const binInput: CreateSequenceBinInput = {
              name: `Découpage - ${new Date().toLocaleTimeString()}`,
              dogma: sequenceBoundDogma ?? activeDogma,
              rootPrompt: storyboardModalContext.currentPrompt,
              shots: shots.map(shot => ({
                shotType: shot.shotType,
                prompt: shot.prompt,
                duration: shot.duration,
                cameraMovement: shot.cameraMovement,
                keyframe: shot.image,
              })),
            };
            const newBin = createBin(binInput);
            console.log('[Studio] Created sequence bin:', newBin.name);
            setStoryboardModalContext(null);
          }}
          apiKey={apiKey || undefined}
        />
      )}

      {/* PROMPT EDITOR MODAL (Revision Chat) */}
      {editingPromptDetails && (
        <PromptEditorModal
          originalPrompt={editingPromptDetails.prompt}
          visualContextBase64={editingPromptDetails.thumbnail}
          onClose={() => setEditingPromptDetails(null)}
          onConfirm={(newPrompt: string) => {
            if (promptSequence && editingPromptDetails) {
              const updated = { ...promptSequence };
              if (editingPromptDetails.index === 0) {
                updated.mainPrompt = newPrompt;
              } else if (updated.extensionPrompts?.[editingPromptDetails.index - 1] !== undefined) {
                updated.extensionPrompts[editingPromptDetails.index - 1] = newPrompt;
              }
              setPromptSequence(updated);
            }
            setEditingPromptDetails(null);
          }}
          dogma={sequenceBoundDogma ?? activeDogma}
          onOpenNanoEditor={() => {
            // Open Nano editor with current context
            if (editingPromptDetails) {
              const keyframe = storyboardByIndex[editingPromptDetails.index];
              if (keyframe) {
                openNanoEditor({
                  segmentIndex: editingPromptDetails.index,
                  baseImage: keyframe.previewImage,
                  initialPrompt: editingPromptDetails.prompt,
                });
              }
            }
            setEditingPromptDetails(null);
          }}
        />
      )}

      {/* THEME MODAL */}
      {showThemeModal && (
        <ThemeSwitcher variant="full" onClose={() => setShowThemeModal(false)} />
      )}

    </ErrorBoundary>
  );
};

export default Studio;