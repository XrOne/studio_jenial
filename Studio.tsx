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
import VideoResult from './components/VideoResult';
import VisualContextViewer from './components/VisualContextViewer';
import useLocalStorage from './hooks/useLocalStorage';
import { useShotLibrary } from './hooks/useShotLibrary'; // New Hook
import {
  generateVideo,
  reviseFollowingPrompts,
  getApiKey,
  hasCustomApiKey,
  fetchGeminiConfig,
  getLocalApiKey,
  ApiError,
} from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import {
  AppState,
  AppStage,
  Character,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  PromptSequence,
  SavedShot,
  SequenceProgress,
  SequenceVideoData,
  VeoModel,
  VideoFile,
  VideoProvider,
} from './types';

// Removed conflicting window.aistudio declaration

const declicsDogma: Dogma = {
  id: 'declics-dogma-v1', // Stable ID
  title: 'DA Déclics - Lumière & Ombre',
  text: `
You are the AI Art Director for the series "Déclics" - visual style "LIGHT AND SHADOW". Your mission is to choose the best rendering strategy for each shot, based on the analysis of the reference image, and then generate a detailed prompt that strictly respects our binary "LIGHT AND SHADOW" artistic direction.

### PRIMARY MISSION

Analyze the reference image. Is it a simple, high-impact composition, or a complex scene with many elements that risk overlapping? Based on your conclusion, **choose one of the two strategies below** and apply it rigorously.

---
### STRATEGY A: "PURE GRAPHIC CONTRAST"
**(To be used for simple and iconic scenes where readability is obvious)**

1.  **Absolute Golden Rule:** EVERYTHING material (characters, objects, set, nature) is a **pure black silhouette (#000000)**.
2.  **Specifications:** Solid, monolithic, opaque, without any detail, texture, reflection, or shade of gray.
3.  **Light:** The only exception is the light source (sky, lamp halo), which is photorealistic and can contain colors and nuances.
4.  **Negative Prompt:** Must include \`gray silhouettes\`.

---
### STRATEGY B: "ATMOSPHERIC DEPTH"
**(To be used for complex scenes where silhouettes could merge and become unreadable)**

1.  **Depth Rule (Z-Depth):** The background is lighter than the foreground. The gradient must be subtle and progressive. The foreground is never pure black to remain readable.
2.  **Readability Rule:** You must intelligently "cheat" to separate overlapping dark shapes by using:
    - Very dark grayscale value offsets.
    - Atmospheric layers (suspended dust, volumetric mist, stray light rays).
3.  **Nuanced Silhouette Rule:** Shapes remain very dark and without texture, but can receive subtle tints from ambient light to differentiate themselves.
4.  **Negative Prompt:** Must NOT include \`gray silhouettes\`, but must insist on \`merged silhouettes, flat black shapes, lack of depth\`.

---
### UNIVERSAL RULES
1.  **Animation Style:** All motion must be natural and realistic. Avoid any cartoonish, exaggerated, or physically impossible animations. The movement should feel grounded and fluid, respecting the laws of physics unless specified otherwise for a specific effect.
2.  **Negative Prompts:** Actively use the \`negative_prompt\` field to enforce the artistic direction. For instance, to maintain the stark, minimalist aesthetic, always include negative prompts like \`cartoon, 3d render, video game, drawing, painting, illustrative\`. To ensure fluid motion, add \`jerky movement, stuttering animation\`.
`.trim(),
  referenceImages: [],
};

const satinEtStatiqueDogma: Dogma = {
  id: 'satin-statique-dogma-v1',
  title: 'Dogma: Satin & Statique',
  text: `
Vous êtes le grand directeur artistique IA, metteur en scène et chef opérateur. Votre mission est de naviguer une dualité esthétique radicale, oscillant entre une pureté glaciale et une fureur analogique. Vous devez choisir l'un des deux modes ci-dessous pour chaque plan, sans jamais les mélanger. Le passage de l'un à l'autre doit être une rupture narrative brutale.

---
### MODE A: "SATIN" (L'ÉPURE GLACIALE)
**(À utiliser pour les scènes d'exposition, les moments de calme avant la tempête, l'esthétique du défilé de mode.)**

1.  **Règle Visuelle:** Propreté clinique et absolue. Esthétique de défilé de mode, "fashion week". Image 4K, couleurs hyper-calibrées et saturées, peaux parfaitement lissées. L'image est léchée, publicitaire, presque stérile dans sa perfection.
2.  **Lumière:** Douce, diffuse, enveloppante. Pas d'ombres dures. Éclairage de studio perfectly maîtrisé.
3.  **Caméra:** Mouvements fluides, gracieux et contrôlés. Lents travellings, panoramiques amples, plans stables sur grue ou Steadicam.
4.  **Mots-clés Positifs:** \`ultra-high definition\`, \`4k\`, \`fashion film\`, \`flawless skin\`, \`vibrant colors\`, \`soft studio lighting\`, \`smooth camera movement\`.
5.  **Mots-clés Négatifs:** \`film grain\`, \`dust\`, \`scratches\`, \`handheld camera\`, \`shaky cam\`, \`harsh shadows\`.

---
### MODE B: "STATIQUE" (LA FUREUR ANALOGIQUE)
**(À utiliser pour les moments de chaos, de violence, de rupture et de tension psychologique.)**

1.  **Règle Visuelle:** Hommage direct au cinéma des années 70 et à l'esthétique des clips de Skrillex. L'image doit être "sale". Grain de pellicule 35mm très prononcé, poussières, rayures, aberrations chromatiques.
2.  **Lumière:** Contraste brutal et écrasé. Hautes lumières brûlées, noirs profonds, "lens flares" agressifs. Lumière souvent dure, venant d'une seule source.
3.  **Caméra:** Chaos contrôlé. Caméra à l'épaule instable ("shaky cam"), zooms brutaux ("crash zooms"), changements de focus rapides, très gros plans anxiogènes.
4.  **Mots-clés Positifs:** \`35mm film grain\`, \`70s thriller aesthetic\`, \`style of Sidney Lumet\`, \`dust and scratches\`, \`high contrast\`, \`blown-out highlights\`, \`crushed blacks\`, \`anamorphic lens flare\`, \`handheld shaky camera\`, \`extreme close-up\`, \`rack focus\`.
5.  **Mots-clés Négatifs:** \`clean\`, \`digital look\`, \`4k\`, \`soft light\`, \`stable shot\`, \`smooth movement\`.

---
### MANDATS DE RÉALISATION (RÈGLES UNIVERSELLES)

1.  **Arc Narratif : La Révolte.** Le clip doit raconter l'histoire d'un défilé de mode qui bascule dans le chaos. Il commence en Mode SATIN et, à un point de rupture précis (un mannequin qui se rebelle), passe brutalement et définitivement en Mode STATIQUE.
2.  **La Transformation (Femmes-Gommes) :** Les mannequins commencent comme des "femmes-gommes" en Mode SATIN – des silhouettes parfaites, presque sans âme. En Mode STATIQUE, elles deviennent des forces primales, agressives, leur individualité explosant à travers des expressions intenses.
3.  **Le Point de Rupture :** La transition du Mode SATIN au Mode STATIQUE doit être un choc visuel et sonore. Elle est déclenchée par une action violente : un vêtement déchiré, un talon utilisé comme arme.
4.  **Focus sur le Gros Plan :** Quel que soit le mode, utilisez massivement les très gros plans (TGP) : sur un regard, une bouche, des mains crispées, un talon aiguille menaçant. Le TGP est l'outil principal pour raconter l'histoire intime et la montée de la tension.
`.trim(),
  referenceImages: [],
};

const PromptConception: React.FC<{
  motionDescription: string | null;
  referenceImage: ImageFile | null;
  activeChatImage: ImageFile | null;
  mentionedCharacters: Character[];
  sequenceHistory?: SequenceVideoData[]; // Feature 2: Time Injection
}> = ({ motionDescription, referenceImage, activeChatImage, mentionedCharacters, sequenceHistory = [] }) => {
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
            {/* Feature 2: Time Injection - Timeline Visualization */}
            {sequenceHistory.length > 0 && (
              <div className="flex flex-col gap-2 bg-gray-800/50 p-2 rounded-xl border border-gray-700/50">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Sequence Flow</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900 text-indigo-300">{sequenceHistory.length} shots</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                  {sequenceHistory.map((data, idx) => (
                    <div key={idx} className="flex-shrink-0 w-24 snap-start relative group">
                      <div className="aspect-video rounded-md overflow-hidden border border-gray-600">
                        {data.thumbnail ? (
                          <img src={`data:image/jpeg;base64,${data.thumbnail}`} className="w-full h-full object-cover" alt={`Shot ${idx + 1}`} />
                        ) : (
                          <div className="w-full h-full bg-gray-900 flex items-center justify-center text-xs text-gray-500">Shot {idx + 1}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-center text-gray-500 mt-1">Shot {idx + 1}</div>
                      {idx === sequenceHistory.length - 1 && (
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Current Anchor" />
                      )}
                    </div>
                  ))}
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
  const [originalVideoForExtension, setOriginalVideoForExtension] =
    useState<VideoFile | null>(null);
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
  const activeDogma = useMemo(
    () => dogmas.find((d) => d.id === activeDogmaId) ?? null,
    [dogmas, activeDogmaId],
  );
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

  useEffect(() => {
    setDogmas((currentDogmas) => {
      const defaultDogmasToAdd: Dogma[] = [];
      const declicsExists = currentDogmas.some(
        (d) => d.id === 'declics-dogma-v1',
      );
      const satinExists = currentDogmas.some(
        (d) => d.id === 'satin-statique-dogma-v1',
      );

      if (!declicsExists) {
        defaultDogmasToAdd.push(declicsDogma);
      }
      if (!satinExists) {
        defaultDogmasToAdd.push(satinEtStatiqueDogma);
      }

      if (defaultDogmasToAdd.length > 0) {
        return [...defaultDogmasToAdd, ...currentDogmas];
      }
      return currentDogmas;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      setAppState(AppState.LOADING);
      setErrorMessage(null);
      setLastConfig(params);
      setInitialFormValues(null);

      if (
        !assistantExtensionContext &&
        params.mode !== GenerationMode.EXTEND_VIDEO
      ) {
        setAssistantExtensionContext(null);
        setAssistantMotionDescription(null);
        setOriginalVideoForExtension(null);
      }

      // Don't clear assistantImage immediately so context radar persists during load
      // setAssistantImage(null); 
      setAssistantReferenceVideo(null);
      setMentionedCharacters([]);

      if (currentPromptIndex === 0) {
        setMainPromptConfig(params);
      }

      try {
        // Use Gemini API for video generation
        const res = await generateVideo(
          params,
          abortControllerRef.current.signal,
        );
        const { objectUrl, blob, video } = res;

        if (promptSequence && currentPromptIndex !== -1) {
          try {
            const thumbnail = await generateThumbnail(blob);
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
          if (errorMessage.includes('Requested entity was not found.') || errorMessage.includes('404')) {
            userFriendlyMessage = 'Model or Key issue. Please check if your API Key is valid and has access to Veo.';
            dialogErrorMsg = 'Clé API non valide pour Veo.';
            shouldOpenDialog = true;
          } else if (
            errorMessage.includes('API_KEY_INVALID') ||
            errorMessage.includes('API key not valid') ||
            errorMessage.toLowerCase().includes('permission denied') ||
            errorMessage.includes('API_KEY_MISSING') ||
            errorMessage.includes('403')
          ) {
            userFriendlyMessage = 'Your API key is invalid, missing, or does not have the required permissions.';
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
    setAppState(AppState.IDLE);
    setCurrentStage(AppStage.PROMPTING);
    setVideoUrl(null);
    setLastConfig(null);
    setLastVideoObject(null);
    setLastVideoBlob(null);
    setPromptSequence(null);
    setActivePromptIndex(null);
    setSequenceProgress(null);
    setSequenceVideoData({});
    setMainPromptConfig(null);
    setInitialFormValues(null);
    setOriginalVideoForExtension(null);
    setAssistantExtensionContext(null);
    setAssistantImage(null);
    setAssistantReferenceVideo(null);
    setAssistantMotionDescription(null);
    setMentionedCharacters([]);
  }, [confirmUnsavedVideo]);

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
    setPromptSequence(sequence);
    const firstPrompt = sequence.mainPrompt;
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
      alert(
        'Please generate the previous video in the sequence before continuing.',
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

      if (previousVideo) {
        const newConfig: GenerateVideoParams = {
          ...(mainPromptConfig as GenerateVideoParams),
          prompt: nextPrompt,
          mode: GenerationMode.EXTEND_VIDEO,
          inputVideoObject: previousVideo.video,
        };
        setInitialFormValues(newConfig);
        setCurrentStage(AppStage.PROMPTING);
      } else {
        alert(
          'Cannot continue sequence: the result from the previous step is missing.',
        );
      }
    }
  };

  const handleClearSequence = () => {
    setPromptSequence(null);
    setActivePromptIndex(null);
    setSequenceProgress(null);
    setSequenceVideoData({});
    setMainPromptConfig(null);
    setInitialFormValues(null);
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
    const allPrompts = [
      promptSequence.mainPrompt,
      ...promptSequence.extensionPrompts,
    ];
    allPrompts[index] = newPrompt;
    const newSequence: PromptSequence = {
      mainPrompt: allPrompts[0],
      extensionPrompts: allPrompts.slice(1),
    };
    setEditingPromptDetails(null);

    const promptsToRevise = allPrompts.slice(index + 1);
    if (promptsToRevise.length > 0) {
      setIsRevisingSequence({ fromIndex: index });
      try {
        const revisedFollowing = await reviseFollowingPrompts({
          dogma: activeDogma,
          promptBefore: allPrompts[index - 1],
          editedPrompt: newPrompt,
          promptsToRevise,
        });
        const finalPrompts = [
          ...allPrompts.slice(0, index + 1),
          ...revisedFollowing,
        ];
        const finalSequence: PromptSequence = {
          mainPrompt: finalPrompts[0],
          extensionPrompts: finalPrompts.slice(1),
        };
        setPromptSequence(finalSequence);
      } catch (e) {
        console.error('Failed to revise subsequent prompts', e);
        setPromptSequence(newSequence);
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
            dogma={activeDogma}
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
                        />
                      ) : (
                        <PromptConception
                          motionDescription={assistantMotionDescription}
                          referenceImage={assistantExtensionContext}
                          activeChatImage={assistantImage}
                          mentionedCharacters={mentionedCharacters}
                          // Pass sequence history values to enable timeline view
                          sequenceHistory={Object.values(sequenceVideoData)}
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