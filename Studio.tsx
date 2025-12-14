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
import VideoResult from './components/VideoResult';
import VisualContextViewer from './components/VisualContextViewer';
import useLocalStorage from './hooks/useLocalStorage';
import { useShotLibrary } from './hooks/useShotLibrary';
import { useSessionPersistence } from './hooks/useSessionPersistence'; // New // New Hook
import {
  generateVideo,
  reviseFollowingPrompts,
  getApiKey,
  hasCustomApiKey,
  fetchGeminiConfig,
  getLocalApiKey,
  ApiError,
  uploadToGoogleFiles,
} from './services/geminiService';
import { generatePreview as generateNanoPreview } from './services/nanoService';
import { useAuth } from './contexts/AuthContext';
import {
  AppState,
  AppStage,
  Character,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  NanoApplyPayload,
  NanoEditorContext,
  PromptSequence,
  PromptSequenceStatus,
  SavedShot,
  SequenceProgress,
  SequenceVideoData,
  StoryboardPreview,
  VeoModel,
  VideoFile,
  VideoProvider,
} from './types';

// ===================================================================
// NEUTRAL DEFAULT: No hardcoded dogmas
// Dogma templates are available in data/dogmaTemplates.ts for optional import
// ===================================================================

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
        file: new File([], `thumbnail_${segmentIndex}.jpg`, { type: 'image/jpeg' }),
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
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentStage, setCurrentStage] = useState<AppStage>(AppStage.PROMPTING);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  const [lastVideoObject, setLastVideoObject] = useState<any | null>(null); // Changed from Video to any
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);
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
      setPromptSequence(restoredPromptSequence);
      setPromptSequence(restoredPromptSequence);

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
          setHasCustomKey(true); // Treat as "has key" for UI purposes
          return;
        }

        // BYOK mode: check if user has a key in localStorage
        const localKey = getLocalApiKey();
        if (!localKey) {
          setShowApiKeyDialog(true);
        } else {
          setHasCustomKey(true);
        }
      } catch {
        // Fallback to BYOK mode if config check fails
        const localKey = getLocalApiKey();
        if (!localKey) {
          setShowApiKeyDialog(true);
        }
        setHasCustomKey(hasCustomApiKey());
      }
    };
    initCheck();
  }, []);

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

  const handleGenerate = useCallback(
    async (params: GenerateVideoParams) => {
      // Strict check for Beta Tester Key
      if (!getApiKey()) {
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
              [currentPromptIndex]: { video, blob, url: objectUrl, thumbnail },
            }));
          } catch (thumbError) {
            console.error(
              'Failed to generate thumbnail for sequence item.',
              thumbError,
            );
            setSequenceVideoData((prev) => ({
              ...prev,
              [currentPromptIndex]: { video, blob, url: objectUrl, thumbnail: '' },
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

  const handleApiKeyContinue = () => {
    const hasKey = hasCustomApiKey();
    setHasCustomKey(hasKey);
    // Only close dialog if key is present
    if (hasKey) {
      setShowApiKeyDialog(false);
    }
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
    // === RULE 3: Bind current dogma to this sequence ===
    const boundDogma = activeDogma;
    setSequenceBoundDogma(boundDogma);
    console.log('[SequenceIntegrity] Bound dogma to sequence:', {
      dogmaId: boundDogma?.id || 'none',
      dogmaTitle: boundDogma?.title || 'none',
    });

    // Create scoped sequence with proper structure
    const scopedSequence: PromptSequence = {
      ...sequence,
      id: sequence.id || crypto.randomUUID(),
      dogmaId: boundDogma?.id ?? null,
      status: PromptSequenceStatus.CLEAN,
      dirtyExtensions: [],
      createdAt: sequence.createdAt || new Date().toISOString(),
    };
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
            dogma: boundDogma,
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
        });
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
      <div className="w-screen h-screen bg-gray-900 font-sans flex flex-col">
        {showApiKeyDialog && <ApiKeyDialog
          onContinue={handleApiKeyContinue}
          hasCustomKey={hasCustomKey}
          providerToken={providerToken}
          errorMessage={apiKeyError || undefined}
        />}
        {/* Persistence Modals */}
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onConfirm={handleProfileConfirm}
          isLoading={isLoadingHistory}
        />
        <SessionHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          sessions={historySessions}
          onRestore={handleRestoreSession}
          isLoading={isLoadingHistory}
        />
        {isShotLibraryOpen && (
          <ShotLibrary
            isOpen={isShotLibraryOpen}
            onClose={() => setIsShotLibraryOpen(false)}
            shots={savedShots}
            onLoadShot={handleLoadShot}
            onDeleteShot={handleDeleteShot}
            onUpdateShotTitle={handleUpdateShotTitle}
          />
        )}
        {isCharacterManagerOpen && (
          <CharacterManager
            isOpen={isCharacterManagerOpen}
            onClose={() => setIsCharacterManagerOpen(false)}
            characters={characters}
            onSaveCharacter={(character) => {
              setCharacters((current) => {
                const existing = current.find((c) => c.id === character.id);
                if (existing) {
                  return current.map((d) =>
                    d.id === character.id ? { ...d, ...character } : d,
                  );
                }
                return [{ ...character, id: `char-${Date.now()}` }, ...current];
              });
            }}
            onDeleteCharacter={(id) =>
              setCharacters((c) => c.filter((char) => char.id !== id))
            }
            onUseCharacter={(character) => {
              handleStartNewProject();
              setCharacterToInject(character);
              setIsCharacterManagerOpen(false);
            }}
          />
        )}
        {isDogmaManagerOpen && (
          <DogmaManager
            isOpen={isDogmaManagerOpen}
            onClose={() => setIsDogmaManagerOpen(false)}
            dogmas={dogmas}
            onSaveDogma={(dogma) => {
              setDogmas((current) => {
                const existing = current.find((d) => d.id === dogma.id);
                if (existing) {
                  return current.map((d) =>
                    d.id === dogma.id ? { ...d, ...dogma } : d,
                  );
                }
                return [{ ...dogma, id: `dogma-${Date.now()}` }, ...current];
              });
            }}
            onDeleteDogma={(id) =>
              setDogmas((c) => c.filter((d) => d.id !== id))
            }
            activeDogmaId={activeDogmaId}
            onSetActiveDogmaId={setActiveDogmaId}
          />
        )}
        {editingPromptDetails && (
          <PromptEditorModal
            originalPrompt={editingPromptDetails.prompt}
            visualContextBase64={editingPromptDetails.thumbnail}
            onClose={() => setEditingPromptDetails(null)}
            onConfirm={(newPrompt) =>
              handleConfirmPromptRevision(editingPromptDetails.index, newPrompt)
            }
            dogma={sequenceBoundDogma}  // Use sequence-bound dogma, NOT global!
            promptBefore={
              promptSequence
                ? [
                  promptSequence.mainPrompt,
                  ...promptSequence.extensionPrompts,
                ][editingPromptDetails.index - 1]
                : undefined
            }
            promptAfter={
              promptSequence
                ? [
                  promptSequence.mainPrompt,
                  ...promptSequence.extensionPrompts,
                ][editingPromptDetails.index + 1]
                : undefined
            }
            onOpenNanoEditor={() => {
              // Create base image from thumbnail for Nano editor
              const baseImage = editingPromptDetails.thumbnail ? {
                file: new File([], 'thumbnail.jpg', { type: 'image/jpeg' }),
                base64: editingPromptDetails.thumbnail,
              } : undefined;

              openNanoEditor({
                segmentIndex: editingPromptDetails.index,
                baseImage,
                initialPrompt: editingPromptDetails.prompt,
              });
            }}
          />
        )}

        {/* NANO BANANA PRO: AI Editor Modal */}
        {nanoEditorContext && nanoEditorContext.baseImage && (
          <AIEditorModal
            image={nanoEditorContext.baseImage}
            onClose={closeNanoEditor}
            onConfirm={(newImage) => {
              // Image-only confirm - for non-prompt workflows
              console.log('[NanoEditor] Image confirmed');
              closeNanoEditor();
            }}
            dogma={nanoEditorContext.dogma}
            onApply={handleNanoApply}
            segmentIndex={nanoEditorContext.segmentIndex}
            target={nanoEditorContext.target}
            initialPrompt={nanoEditorContext.initialPrompt}
          />
        )}

        {/* NANO BANANA PRO: 12 Vignettes Modal */}
        {storyboardModalContext && (
          <StoryboardPreviewModal
            isOpen={true}
            onClose={() => setStoryboardModalContext(null)}
            onApplyVariant={handleNanoApply}
            segmentIndex={storyboardModalContext.segmentIndex}
            baseImage={storyboardModalContext.baseImage}
            currentPrompt={
              storyboardModalContext.segmentIndex === 0
                ? promptSequence?.mainPrompt || ''
                : promptSequence?.extensionPrompts[storyboardModalContext.segmentIndex - 1] || ''
            }
            dogma={sequenceBoundDogma ?? activeDogma}
          />
        )}
        <header className="flex justify-between items-center p-4 border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={handleStartNewProject}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              title="Start New Project">
              <CurvedArrowDownIcon className="w-6 h-6 rotate-90" />
              <span className="hidden sm:inline">Back to start</span>
            </button>
            <div className="w-px h-6 bg-gray-700"></div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Veo Studio
            </h1>
            {isCloudEnabled && (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                <UploadCloudIcon className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">Cloud Sync Active</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">

            <button
              onClick={() => setIsDogmaManagerOpen(true)}
              title={activeDogma ? `Active Dogma: ${activeDogma.title}` : "No Active Dogma"}
              className="relative flex items-center gap-2 px-3 py-2 bg-gray-700/80 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
              <BookMarkedIcon className="w-5 h-5" />
              <div className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-gray-800 ${activeDogma ? 'bg-green-500' : 'bg-gray-500'}`} />
            </button>

            <button
              onClick={() => setShowApiKeyDialog(true)}
              title={hasCustomKey ? "Using Custom Beta Key" : "Using Default Key"}
              className={`flex items-center gap-2 px-3 py-2 ${hasCustomKey ? 'bg-green-600/20 text-green-400 border border-green-600/50' : 'bg-red-900/20 text-red-400 border border-red-800/50'} font-semibold rounded-lg transition-colors`}>
              <KeyIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsCharacterManagerOpen(true)}
              title="Character Library"
              className="flex items-center gap-2 px-3 py-2 bg-gray-700/80 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
              <UsersIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsShotLibraryOpen(true)}
              title="Shot Library"
              className="flex items-center gap-2 px-3 py-2 bg-gray-700/80 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors">
              <FilmIcon className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-1"></div>
            <button
              onClick={handleOpenHistory}
              title="Session History"
              className={`flex items-center gap-2 px-3 py-2 bg-gray-700/80 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors ${isSaving ? 'animate-pulse border border-green-500/50' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

          </div>
        </header>
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
                      />
                    </div>
                    <div className="col-span-1 h-full">
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
                          onThumbnailClick={(thumbnailBase64, index) => {
                            // Open Nano editor for this segment
                            const prompt = index === 0
                              ? promptSequence.mainPrompt
                              : promptSequence.extensionPrompts[index - 1] || '';
                            const baseImage = thumbnailBase64 ? {
                              file: new File([], `keyframe_${index}.png`, { type: 'image/png' }),
                              base64: thumbnailBase64,
                            } : storyboardByIndex[index]?.previewImage;
                            if (baseImage) {
                              openNanoEditor({ segmentIndex: index, baseImage, initialPrompt: prompt });
                            }
                          }}
                        />
                      ) : (
                        <PromptConception
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
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default Studio;