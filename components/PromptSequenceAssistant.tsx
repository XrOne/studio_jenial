/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  generateImageFromText,
  generatePromptFromImage,
  generatePromptSequence,
  generateSequenceFromConversation,
  generateStoryboard,
  toggleTranslateText,
} from '../services/geminiService';
import {
  AspectRatio,
  Character,
  ChatMessage,
  Dogma,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  PromptSequence,
  Resolution,
  Storyboard,
  VeoModel,
  VideoFile,
  VideoProvider,
} from '../types';
import AIEditorModal from './AIEditorModal';
import CameraKit from './CameraKit';
import {
  ArrowRightIcon,
  CameraIcon,
  ChevronDownIcon,
  FilmIcon,
  FramesModeIcon,
  LayoutGridIcon,
  MagicWandIcon,
  PaperclipIcon,
  PencilIcon,
  RectangleStackIcon,
  ReferencesModeIcon,
  ScissorsIcon,
  SlidersHorizontalIcon,
  SwapHorizontallyIcon,
  TextModeIcon,
  TvIcon,
  UsersIcon,
  VideoIcon,
  XMarkIcon,
  MessageSquareIcon,
} from './icons';
import { fileToBase64, ImageUpload } from './PromptForm';
import ImageGenerationModal from './ImageGenerationModal';
import StoryboardPreviewModal from './StoryboardPreviewModal';
import VideoAnalysisModal from './VideoAnalysisModal';
import VideoFrameSelectorModal from './VideoFrameSelectorModal';

interface PromptSequenceAssistantProps {
  onSequenceGenerated: (sequence: PromptSequence, isExtension: boolean) => void;
  activeDogma: Dogma | null;
  onOpenDogmaManager: () => void;
  onOpenCharacterManager: () => void;
  extensionContext?: ImageFile | null;
  initialValues?: GenerateVideoParams | null;
  onGenerate: (params: GenerateVideoParams) => void;
  onStartExternalExtensionAssistant: (context: {
    lastFrame: ImageFile;
    motionDescription: string;
    originalVideo: File;
  }) => void;
  onClearContext: () => void;
  assistantImage: ImageFile | null;
  onAssistantImageChange: (image: ImageFile | null) => void;
  assistantReferenceVideo: VideoFile | null;
  videoForExtension?: any | null; // Changed from Video to any
  characterToInject: Character | null;
  onCharacterInjected: () => void;
  characters: Character[];
  onMentionedCharactersChange: (characters: Character[]) => void;
  motionDescription?: string | null; // Continuity context from modal
  onProvisionalSequence?: (prompt: string) => void; // P1: Auto-trigger keyframe
}



type AssistantResult = {
  creativePrompt: string;
  veoOptimizedPrompt: string;
};

const aspectRatioDisplayNames: Record<AspectRatio, string> = {
  [AspectRatio.LANDSCAPE]: 'Landscape (16:9)',
  [AspectRatio.PORTRAIT]: 'Portrait (9:16)',
};

const qualityDisplayNames: Record<Resolution, string> = {
  [Resolution.P720]: 'Standard (720p)',
  [Resolution.P1080]: 'HD (1080p)',
};

const modelDisplayNames: Record<VeoModel, string> = {
  [VeoModel.VEO_FAST]: 'Veo Fast',
  [VeoModel.VEO]: 'Veo',
  [VeoModel.VEO_3]: 'Veo 3 (Legacy)',
};

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.TEXT_TO_VIDEO]: <TextModeIcon className="w-5 h-5" />,
  [GenerationMode.FRAMES_TO_VIDEO]: <FramesModeIcon className="w-5 h-5" />,
  [GenerationMode.REFERENCES_TO_VIDEO]: (
    <ReferencesModeIcon className="w-5 h-5" />
  ),
  [GenerationMode.EXTEND_VIDEO]: <FilmIcon className="w-5 h-5" />,
};

const fileToImageFile = (file: File): Promise<ImageFile> =>
  fileToBase64<ImageFile>(file);

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ label, value, onChange, icon, children, disabled = false }) => (
  <div>
    <label
      className={`text-xs block mb-1.5 font-medium ${disabled ? 'text-gray-500' : 'text-gray-400'
        }`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {icon}
      </div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full bg-[#1f1f1f] border border-gray-600 rounded-lg pl-10 pr-8 py-2.5 appearance-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700/50 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
        {children}
      </select>
      <ChevronDownIcon
        className={`w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${disabled ? 'text-gray-600' : 'text-gray-400'
          }`}
      />
    </div>
  </div>
);

const PromptSequenceAssistant: React.FC<PromptSequenceAssistantProps> = ({
  onSequenceGenerated,
  activeDogma,
  onOpenDogmaManager,
  onOpenCharacterManager,
  extensionContext,
  initialValues,
  onGenerate,
  onStartExternalExtensionAssistant,
  onClearContext,
  assistantImage,
  onAssistantImageChange,
  assistantReferenceVideo,
  videoForExtension,
  characterToInject,
  onCharacterInjected,
  characters,
  onMentionedCharactersChange,
  motionDescription,
  onProvisionalSequence,
}) => {
  // --- Merged State from PromptForm ---
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [model, setModel] = useState<VeoModel>(
    initialValues?.model ?? VeoModel.VEO,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE,
  );
  const [resolution, setResolution] = useState<Resolution>(
    initialValues?.resolution ?? Resolution.P720,
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO,
  );
  const [startFrame, setStartFrame] = useState<ImageFile | null>(
    initialValues?.startFrame ?? null,
  );
  const [endFrame, setEndFrame] = useState<ImageFile | null>(
    initialValues?.endFrame ?? null,
  );
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(
    initialValues?.referenceImages ?? [],
  );
  const [inputVideoObject, setInputVideoObject] = useState<any | null>(
    initialValues?.inputVideoObject ?? null,
  );
  const [isLooping, setIsLooping] = useState(
    initialValues?.isLooping ?? false,
  );
  const [activeTab, setActiveTab] = useState<'assistant' | 'studio'>('assistant');
  const [isCameraKitOpen, setIsCameraKitOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [isAutoDescribing, setIsAutoDescribing] = useState(false);
  const [videoForAnalysis, setVideoForAnalysis] = useState<File | null>(null);
  const [editingImage, setEditingImage] = useState<{
    image: ImageFile;
    onConfirm: (newImage: ImageFile) => void;
  } | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [storyboardError, setStoryboardError] = useState<string | null>(null);
  const [isFrameSelectorOpen, setIsFrameSelectorOpen] = useState<{
    onConfirm: (img: ImageFile) => void;
  } | null>(null);
  const [imageGenerationTarget, setImageGenerationTarget] = useState<
    'start' | 'end' | null
  >(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isBananaOpen, setIsBananaOpen] = useState(false);
  const [videoProvider, setVideoProvider] = useState<VideoProvider>(
    (localStorage.getItem('video_provider') as VideoProvider) || VideoProvider.GEMINI
  );

  // --- Assistant-specific State ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [duration, setDuration] = useState('8');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<AssistantResult | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);
  const externalVideoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [characterMentionRef, setCharacterMentionRef] = useState<ImageFile[]>(
    [],
  );

  const resetAssistantState = useCallback(
    (
      context?: {
        lastFrame: ImageFile;
        motionDescription: string;
      } | 'new_chat',
    ) => {
      let initialMessage: ChatMessage;
      if (context && context !== 'new_chat') {
        initialMessage = {
          role: 'assistant',
          content: `Je suis prêt à vous aider à étendre votre vidéo. En me basant sur cette dernière image, que doit-il se passer ensuite pour continuer l'action de manière fluide ? J'ai bien noté le vecteur de mouvement précédent, affiché à droite.`,
          image: context.lastFrame,
        };
        setDuration('4');
      } else {
        initialMessage = {
          role: 'assistant',
          content:
            "Hello! I'm your sequence planning assistant. Describe the scene you'd like to create, and we'll build the prompts together. What's your idea?",
          image: null,
        };
        setDuration('8');
      }
      setMessages([initialMessage]);
      setFinalResult(null);
      setUserInput('');
      onAssistantImageChange(null);
      setError(null);
      setIsLoading(false);
      setIsConfiguring(false);
    },
    [onAssistantImageChange],
  );

  useEffect(() => {
    if (initialValues) {
      setPrompt(initialValues.prompt ?? '');
      setModel(initialValues.model ?? VeoModel.VEO);
      setAspectRatio(initialValues.aspectRatio ?? AspectRatio.LANDSCAPE);
      setResolution(initialValues.resolution ?? Resolution.P720);
      setGenerationMode(initialValues.mode ?? GenerationMode.TEXT_TO_VIDEO);
      setStartFrame(initialValues.startFrame ?? null);
      setEndFrame(initialValues.endFrame ?? null);
      setReferenceImages(initialValues.referenceImages ?? []);
      setInputVideoObject(initialValues.inputVideoObject ?? null);
      setIsLooping(initialValues.isLooping ?? false);
      setIsConfiguring(true);
      setActiveTab('studio'); // Switch to studio tab if initial values are present
      setMessages([]);
    } else if (characterToInject) {
      resetAssistantState('new_chat');
      const initialMessage: ChatMessage = {
        role: 'assistant',
        content: `J'ai chargé le personnage "${characterToInject.name}". Construisons une scène pour lui/elle. Que doit-il se passer ?`,
        image: null,
      };
      setMessages([initialMessage]);
      setUserInput(
        `@${characterToInject.name}, ${characterToInject.description}`,
      );
      onCharacterInjected();
    } else if (extensionContext) {
      const simpleExtensionContext = {
        lastFrame: extensionContext,
        motionDescription: "l'action précédente",
      };
      resetAssistantState(simpleExtensionContext);
    } else {
      resetAssistantState('new_chat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, extensionContext, characterToInject]);

  // Effect to Sync Studio Start Frame to Assistant Context
  useEffect(() => {
    if (activeTab === 'assistant' && startFrame && !assistantImage && !extensionContext) {
      onAssistantImageChange(startFrame);
    }
  }, [activeTab, startFrame, assistantImage, onAssistantImageChange, extensionContext]);


  useEffect(() => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = userInput.match(mentionRegex);
    if (matches) {
      const mentionedNames = matches.map((mention) =>
        mention.substring(1).toLowerCase(),
      );
      const foundCharacters = characters.filter((char) =>
        mentionedNames.includes(char.name.toLowerCase()),
      );
      onMentionedCharactersChange(
        Array.from(new Map(foundCharacters.map((c) => [c.id, c])).values()),
      );
    } else {
      onMentionedCharactersChange([]);
    }
  }, [userInput, characters, onMentionedCharactersChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, finalResult]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [prompt]);

  useEffect(() => {
    const textarea = chatTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [userInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeSelectorRef.current &&
        !modeSelectorRef.current.contains(event.target as Node)
      ) {
        setIsModeSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (assistantReferenceVideo) {
      objectUrl = URL.createObjectURL(assistantReferenceVideo.file);
      setReferenceVideoUrl(objectUrl);
    } else {
      setReferenceVideoUrl(null);
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [assistantReferenceVideo]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToImageFile(file);
        onAssistantImageChange(imageFile);
      } catch (error) {
        console.error('Error handling image upload:', error);
        setError('Failed to process the image file.');
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() && !assistantImage) return;

    const currentMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userInput, image: assistantImage },
    ];
    setMessages(currentMessages);
    setUserInput('');

    // CRITICAL FIX: Do NOT clear the assistant image here. 
    // We want it to persist in the Context Radar (PromptConception).
    // User can manually remove it with the X button if needed.
    // onAssistantImageChange(null); 

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateSequenceFromConversation(
        currentMessages,
        activeDogma,
        parseInt(duration, 10),
        extensionContext,
        motionDescription,
      );

      if (typeof result === 'string') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result, image: null },
        ]);
      } else if (result.creativePrompt && result.veoOptimizedPrompt) {
        setFinalResult(result as AssistantResult);
        // P1: Auto-trigger keyframe generation
        if (onProvisionalSequence) {
          console.log('[Assistant] Triggering provisional sequence for keyframe generation');
          onProvisionalSequence(result.veoOptimizedPrompt);
        }
      }
    } catch (err) {
      // Extract error info - now includes user-friendly message from backend
      const errorObj = err as any;
      const errorCode = errorObj.code || 'UNKNOWN_ERROR';
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';

      // Log for debugging
      console.error('[Assistant] Chat error', { code: errorCode, message: errorMessage });

      setError(errorMessage);

      // Create user-friendly message based on error code
      let displayMessage = errorMessage;
      if (errorCode === 'PAYLOAD_TOO_LARGE') {
        displayMessage = `⚠️ ${errorMessage}\n\n💡 Conseil : Supprimez les images du contexte ou commencez une nouvelle conversation.`;
      } else if (errorCode === 'QUOTA_EXCEEDED') {
        displayMessage = `⚠️ ${errorMessage}\n\n💡 Conseil : Attendez quelques minutes ou utilisez une autre clé API.`;
      } else if (errorCode === 'UNAUTHORIZED') {
        displayMessage = `🔑 ${errorMessage}\n\n💡 Conseil : Vérifiez votre clé API dans les paramètres.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: displayMessage,
          image: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const params: GenerateVideoParams = {
        prompt,
        model,
        aspectRatio,
        resolution,
        mode: generationMode,
        startFrame,
        endFrame,
        referenceImages: [...referenceImages, ...characterMentionRef],
        styleImage: null,
        inputVideo: null,
        inputVideoObject:
          generationMode === GenerationMode.EXTEND_VIDEO
            ? videoForExtension ?? inputVideoObject
            : null,
        isLooping,
        provider: videoProvider,
        vertexConfig: videoProvider === VideoProvider.VERTEX ? {
          projectId: localStorage.getItem('vertex_project_id') || '',
          location: localStorage.getItem('vertex_location') || '',
          accessToken: localStorage.getItem('vertex_token') || ''
        } : undefined,
      };
      onGenerate(params);
    },
    [
      prompt,
      model,
      aspectRatio,
      resolution,
      generationMode,
      startFrame,
      endFrame,
      referenceImages,
      inputVideoObject,
      isLooping,
      onGenerate,
      videoForExtension,
      characterMentionRef,
    ],
  );

  const handleAcceptFinalPrompt = async () => {
    if (!finalResult) return;
    setIsLoading(true);
    setError(null);
    try {
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const matches = finalResult.veoOptimizedPrompt.match(mentionRegex);
      const finalMentionedCharacters = matches
        ? characters.filter((char) =>
          matches
            .map((m) => m.substring(1).toLowerCase())
            .includes(char.name.toLowerCase()),
        )
        : [];

      const durationNum = parseInt(duration, 10);
      const isExtension = !!extensionContext;

      if (durationNum > 8) {
        const sequence = await generatePromptSequence(
          finalResult.veoOptimizedPrompt,
          durationNum,
          activeDogma,
        );
        onSequenceGenerated(sequence, isExtension);
      } else {
        setPrompt(finalResult.veoOptimizedPrompt);
        if (isExtension) {
          setGenerationMode(GenerationMode.EXTEND_VIDEO);
          setInputVideoObject(videoForExtension ?? null);
        } else if (finalMentionedCharacters.length > 0) {
          setGenerationMode(GenerationMode.REFERENCES_TO_VIDEO);
          const characterImages: ImageFile[] = finalMentionedCharacters.flatMap(
            (char) =>
              char.images.map((img) => {
                const byteString = atob(img.base64);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i);
                }
                const blob = new Blob([ab], { type: img.type });
                const file = new File([blob], img.name, { type: img.type });
                return { file, base64: img.base64 };
              }),
          );
          setCharacterMentionRef(characterImages);
        } else {
          const imageContext =
            assistantImage ||
            messages
              .slice()
              .reverse()
              .find((m) => m.role === 'user' && m.image)?.image;
          setGenerationMode(
            imageContext
              ? GenerationMode.FRAMES_TO_VIDEO
              : GenerationMode.TEXT_TO_VIDEO,
          );
          setStartFrame(imageContext || null);
        }
        // Switch to Studio tab after accepting prompt
        setActiveTab('studio');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUploadAndDescribe = useCallback(
    async (
      imageFile: ImageFile,
      imageSetter: (img: ImageFile | null) => void,
      isReference = false,
    ) => {
      imageSetter(imageFile);
      const shouldDescribe = !prompt.trim() && !isReference;
      if (shouldDescribe) {
        setIsAutoDescribing(true);
        try {
          const description = await generatePromptFromImage(imageFile);
          setPrompt(description);
        } catch (error) {
          console.error('Auto-description failed:', error);
        } finally {
          setIsAutoDescribing(false);
        }
      }
    },
    [prompt],
  );

  const handleSelectMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setIsModeSelectorOpen(false);
    setStartFrame(null);
    setEndFrame(null);
    setReferenceImages([]);
    setInputVideoObject(null);
    setIsLooping(false);
  };

  const handleExternalVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoForAnalysis(file);
    }
    if (externalVideoInputRef.current) {
      externalVideoInputRef.current.value = '';
    }
  };

  const handleAnalysisConfirm = (context: {
    lastFrame: ImageFile;
    motionDescription: string;
    originalVideo: File;
  }) => {
    setVideoForAnalysis(null);
    onStartExternalExtensionAssistant(context);
  };

  const handleSelectCamera = (text: string) => {
    setUserInput((prev) => `${prev} ${text}`.trim());
    setPrompt((prev) => `${prev} ${text}`.trim());
  };

  const handleTranslatePrompt = async (
    promptToTranslate: string,
    setter: (text: string) => void,
  ) => {
    if (!promptToTranslate.trim() || isTranslating) return;
    setIsTranslating(true);
    setError(null);
    try {
      const translated = await toggleTranslateText(promptToTranslate);
      setter(translated);
    } catch (error) {
      console.error('Translation failed:', error);
      setError('Failed to translate the prompt.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateStoryboard = async (promptToStoryboard: string) => {
    if (!promptToStoryboard.trim()) return;
    setIsGeneratingStoryboard(true);
    setStoryboardError(null);
    try {
      const result = await generateStoryboard(
        promptToStoryboard,
        activeDogma,
        referenceImages,
        startFrame,
        endFrame,
      );
      setStoryboard(result);
    } catch (err) {
      setStoryboardError(
        err instanceof Error ? err.message : 'Failed to create storyboard.',
      );
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const handleConfirmStoryboard = (finalStoryboard: Storyboard) => {
    const newPrompt = finalStoryboard.keyframes
      .map((kf) => kf.description)
      .join(' ');
    setPrompt(newPrompt);
    setStoryboard(null);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value as VeoModel;
    setModel(newModel);
    if (newModel === VeoModel.VEO_FAST && resolution === Resolution.P1080) {
      setResolution(Resolution.P720);
    }
  };

  const handleBananaAction = (targetImage?: ImageFile) => {
    const imgToEdit = targetImage || assistantImage;
    if (imgToEdit) {
      // If image exists, open AI Editor (Banana Edit)
      setEditingImage({
        image: imgToEdit,
        onConfirm: (newImage) => {
          if (targetImage) {
            // If we edited a specific target (like startFrame), update it
            if (targetImage === startFrame) setStartFrame(newImage);
            if (targetImage === endFrame) setEndFrame(newImage);
            // Also update assistant image to keep context
            onAssistantImageChange(newImage);
          } else {
            onAssistantImageChange(newImage);
          }
        }
      });
    } else {
      // If no image, open Image Generator (Banana Gen)
      setIsBananaOpen(true);
    }
  };

  const promptPlaceholder =
    {
      [GenerationMode.TEXT_TO_VIDEO]:
        'A high-stakes handshake between two men...',
      [GenerationMode.FRAMES_TO_VIDEO]: 'Describe the motion between frames...',
      [GenerationMode.REFERENCES_TO_VIDEO]:
        'Describe a video using references...',
      [GenerationMode.EXTEND_VIDEO]: 'Describe what happens next...',
    }[generationMode] || 'Describe the video you want to create...';

  const renderMediaUploads = () => {
    // Always allow media uploads in Studio mode
    if (activeTab !== 'studio') return null;

    const commonContainerClasses =
      'mb-3 p-4 bg-[#2c2c2e] rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-4';

    switch (generationMode) {
      case GenerationMode.FRAMES_TO_VIDEO:
        return (
          <div className={commonContainerClasses}>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <ImageUpload
                  label="Start Image"
                  image={startFrame}
                  onSelect={(img) =>
                    handleImageUploadAndDescribe(img, setStartFrame)
                  }
                  onRemove={() => setStartFrame(null)}
                  onEditRequest={(image) => handleBananaAction(image)}
                />
                <button
                  type="button"
                  onClick={() => setImageGenerationTarget('start')}
                  className="text-xs flex items-center gap-1.5 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors">
                  <MagicWandIcon className="w-3 h-3" />
                  Generate
                </button>
              </div>
              {!isLooping && (
                <div className="flex flex-col items-center gap-2">
                  <ImageUpload
                    label="End Image"
                    image={endFrame}
                    onSelect={(img) =>
                      handleImageUploadAndDescribe(img, setEndFrame)
                    }
                    onRemove={() => setEndFrame(null)}
                    onEditRequest={(image) => handleBananaAction(image)}
                  />
                  <button
                    type="button"
                    onClick={() => setImageGenerationTarget('end')}
                    className="text-xs flex items-center gap-1.5 px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors">
                    <MagicWandIcon className="w-3 h-3" />
                    Generate
                  </button>
                </div>
              )}
            </div>
            {startFrame && (
              <div className="mt-3 flex items-center">
                <input
                  id="loop-video-checkbox"
                  type="checkbox"
                  checked={isLooping}
                  onChange={(e) => setIsLooping(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <label
                  htmlFor="loop-video-checkbox"
                  className="ml-2 text-sm font-medium text-gray-300">
                  Create looping video (end frame will be ignored)
                </label>
              </div>
            )}
          </div>
        );
      case GenerationMode.REFERENCES_TO_VIDEO:
        return (
          <div className={commonContainerClasses}>
            <button
              type="button"
              onClick={onOpenCharacterManager}
              className="text-sm flex items-center gap-2 px-3 py-1.5 bg-gray-600/80 hover:bg-gray-600 text-white rounded-md transition-colors mb-2">
              <UsersIcon className="w-4 h-4" />
              <span>Load from Character Library</span>
            </button>
            <div className="flex items-center justify-center gap-4">
              {[0, 1, 2].map((index) => (
                <ImageUpload
                  key={index}
                  label={`Reference ${index + 1}`}
                  image={referenceImages[index]}
                  onSelect={(img) => {
                    const newImages = [...referenceImages];
                    newImages[index] = img;
                    setReferenceImages(newImages);
                  }}
                  onRemove={() => {
                    setReferenceImages((prev) =>
                      prev.filter((_, i) => i !== index),
                    );
                  }}
                  onEditRequest={(image) => handleBananaAction(image)}
                />
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderConfigurationForm = () => {
    return (
      <>
        <form
          onSubmit={handleFinalSubmit}
          className="w-full flex flex-col gap-3">

          <div
            className="p-4 bg-[#2c2c2e] rounded-xl border border-gray-700"
            title="Advanced generation settings">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CustomSelect
                label="Video Engine"
                value={videoProvider}
                onChange={(e) => {
                  const val = e.target.value as VideoProvider;
                  setVideoProvider(val);
                  localStorage.setItem('video_provider', val);
                }}
                icon={<VideoIcon className="w-5 h-5 text-gray-400" />}>
                <option value={VideoProvider.GEMINI}>Gemini API (Default)</option>
                <option value={VideoProvider.VERTEX}>Vertex AI (Veo)</option>
              </CustomSelect>
              <CustomSelect
                label="Model"
                value={model}
                onChange={handleModelChange}
                icon={<VideoIcon className="w-5 h-5 text-gray-400" />}>
                {Object.entries(modelDisplayNames).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </CustomSelect>
              <CustomSelect
                label="Aspect Ratio"
                value={aspectRatio}
                onChange={(e) =>
                  setAspectRatio(e.target.value as AspectRatio)
                }
                icon={
                  <RectangleStackIcon className="w-5 h-5 text-gray-400" />
                }
                disabled={
                  generationMode === GenerationMode.EXTEND_VIDEO &&
                  !!inputVideoObject
                }>
                {Object.entries(aspectRatioDisplayNames).map(
                  ([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ),
                )}
              </CustomSelect>
              <CustomSelect
                label="Video Quality"
                value={resolution}
                onChange={(e) =>
                  setResolution(e.target.value as Resolution)
                }
                icon={<TvIcon className="w-5 h-5 text-gray-400" />}
                disabled={
                  generationMode === GenerationMode.EXTEND_VIDEO &&
                  !!inputVideoObject
                }>
                {Object.entries(qualityDisplayNames).map(([key, name]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={
                      model === VeoModel.VEO_FAST && key === Resolution.P1080
                    }>
                    {name}{' '}
                    {model === VeoModel.VEO_FAST && key === Resolution.P1080
                      ? '(Veo only)'
                      : ''}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>

          {renderMediaUploads()}

          <div className="flex flex-col gap-2 bg-[#1f1f1f] border border-gray-600 rounded-2xl p-2 shadow-lg focus-within:ring-2 focus-within:ring-indigo-500">
            <div className="relative flex items-end gap-2">
              <div className="relative" ref={modeSelectorRef}>
                <button
                  type="button"
                  onClick={() => setIsModeSelectorOpen((prev) => !prev)}
                  className="flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-700"
                  title={`Current mode: ${generationMode}`}>
                  {modeIcons[generationMode]}
                </button>
                {isModeSelectorOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#2c2c2e] border border-gray-700 rounded-lg shadow-xl z-20 p-2">
                    {Object.values(GenerationMode)
                      .filter((m) => m !== GenerationMode.EXTEND_VIDEO)
                      .map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleSelectMode(mode)}
                          className={`w-full flex items-center gap-3 p-2 rounded-md text-left text-sm transition-colors ${generationMode === mode
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700'
                            }`}>
                          {modeIcons[mode]}
                          <span>{mode}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={promptPlaceholder}
                className="w-full bg-transparent focus:outline-none resize-none text-base text-gray-200 placeholder-gray-500 max-h-48 py-2"
                rows={1}
              />

              <button
                type="submit"
                title="Generate Video"
                className="p-2.5 bg-indigo-600 rounded-full hover:bg-indigo-500">
                <ArrowRightIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-center items-center gap-2 border-t border-gray-700/50 pt-2">
              <button
                type="button"
                onClick={() => handleGenerateStoryboard(prompt)}
                disabled={isGeneratingStoryboard || !prompt.trim()}
                title="Generate Storyboard Preview"
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 disabled:opacity-50">
                {isGeneratingStoryboard ? (
                  <div className="w-5 h-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                ) : (
                  <LayoutGridIcon className="w-5 h-5" />
                )}
              </button>
              {/* Banana Button in Studio Mode */}
              <button
                type="button"
                onClick={() => handleBananaAction()}
                title="AI Image Tools (Banana)"
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
                <PencilIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsCameraKitOpen((p) => !p)}
                title="Camera Kit"
                className={`p-2 rounded-full hover:bg-gray-700 ${isCameraKitOpen ? 'bg-gray-700 text-white' : 'text-gray-400'
                  }`}>
                <CameraIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => handleTranslatePrompt(prompt, setPrompt)}
                disabled={isTranslating || !prompt.trim()}
                title="Translate Prompt (FR/EN)"
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 disabled:opacity-50">
                {isTranslating ? (
                  <div className="w-5 h-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                ) : (
                  <SwapHorizontallyIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {isCameraKitOpen && (
              <CameraKit
                onSelectAngle={(text) =>
                  setPrompt((p) => `${p} ${text}`.trim())
                }
                onSelectMovement={(text) =>
                  setPrompt((p) => `${p} ${text}`.trim())
                }
              />
            )}
          </div>
        </form>
      </>
    );
  };

  const renderCreativeToolbar = () => {
    return (
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex justify-between items-center border-t border-gray-700 pt-2 px-1">
          <div className="flex items-center gap-1">
            {/* Banana Button (Edit/Generate Image) */}
            <button
              type="button"
              onClick={() => handleBananaAction()}
              title={assistantImage ? "Edit Image (Banana)" : "Generate Image (Banana)"}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
              <PencilIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleGenerateStoryboard(userInput)}
              disabled={isGeneratingStoryboard || !userInput.trim()}
              title="Generate Storyboard Preview"
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 disabled:opacity-50">
              {isGeneratingStoryboard ? (
                <div className="w-5 h-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
              ) : (
                <LayoutGridIcon className="w-5 h-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setIsFrameSelectorOpen({ onConfirm: onAssistantImageChange })
              }
              title="Extract Frame from Video"
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
              <ScissorsIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => externalVideoInputRef.current?.click()}
              title="Extend External Video"
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 disabled:opacity-50">
              <VideoIcon className="w-5 h-5" />
            </button>
            <input
              type="file"
              ref={externalVideoInputRef}
              onChange={handleExternalVideoFileChange}
              accept="video/*"
              className="hidden"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCameraKitOpen((p) => !p)}
              title="Camera Kit"
              className={`p-2 rounded-full hover:bg-gray-700 ${isCameraKitOpen ? 'bg-gray-700 text-white' : 'text-gray-400'
                }`}>
              <CameraIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleTranslatePrompt(userInput, setUserInput)}
              disabled={isTranslating || !userInput.trim()}
              title="Translate Prompt (FR/EN)"
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 disabled:opacity-50">
              {isTranslating ? (
                <div className="w-5 h-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
              ) : (
                <SwapHorizontallyIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        {isCameraKitOpen && (
          <CameraKit
            onSelectAngle={handleSelectCamera}
            onSelectMovement={handleSelectCamera}
          />
        )}
      </div>
    );
  };

  const renderChatForm = () => {
    return (
      <div className="mt-auto flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-400">
              Active Dogma:
            </span>
            {activeDogma ? (
              <span className="text-sm font-semibold px-2 py-1 rounded-md bg-green-500/10 text-green-300 border border-green-500/30">
                {activeDogma.title}
              </span>
            ) : (
              <span className="text-sm font-semibold px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/30">
                None
              </span>
            )}
          </div>
          <button
            onClick={onOpenDogmaManager}
            title="Open the Dogma Library to manage artistic rules"
            className="text-sm text-indigo-400 hover:underline">
            Manage
          </button>
        </div>
        {!extensionContext && (
          <div className="flex items-center gap-3 mb-3">
            <label
              htmlFor="duration-input"
              className="text-sm font-medium text-gray-400">
              Total Sequence Duration (seconds)
            </label>
            <input
              id="duration-input"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="8"
              max="60"
              className="w-20 bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 text-center"
            />
          </div>
        )}
        {assistantImage && (
          <div className="p-1 mb-2 bg-gray-900/50 rounded-lg relative w-24">
            <img
              src={URL.createObjectURL(assistantImage.file)}
              alt="Preview"
              className="w-full h-auto rounded"
            />
            <button
              onClick={() => onAssistantImageChange(null)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-sm border border-red-700"
              title="Remove image from Context">
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        <form
          onSubmit={handleChatSubmit}
          className="flex items-start gap-2 bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
            className="p-2.5 rounded-full hover:bg-gray-700 text-gray-300">
            <PaperclipIcon className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <textarea
            ref={chatTextareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit(e);
              }
            }}
            placeholder="Describe your scene here, use @ to mention a character..."
            className="flex-grow bg-transparent focus:outline-none text-base text-gray-200 placeholder-gray-500 px-2 resize-none leading-tight py-2.5"
            disabled={isLoading || !!finalResult}
            rows={1}
          />
          <button
            type="submit"
            disabled={
              isLoading ||
              !!finalResult ||
              (!userInput.trim() && !assistantImage)
            }
            title="Send Message"
            className="p-2.5 bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 self-end">
            <ArrowRightIcon className="w-5 h-5 text-white" />
          </button>
        </form>
        {renderCreativeToolbar()}
      </div>
    );
  };

  return (
    <div className="bg-[#1f1f1f] border border-gray-700 rounded-2xl h-full flex flex-col shadow-lg">
      {/* Modals */}
      {editingImage && (
        <AIEditorModal
          image={editingImage.image}
          onClose={() => setEditingImage(null)}
          onConfirm={(newImage) => {
            editingImage.onConfirm(newImage);
            setEditingImage(null);
          }}
          dogma={activeDogma}
        />
      )}
      {storyboard && (
        <StoryboardPreviewModal
          storyboard={storyboard}
          onClose={() => setStoryboard(null)}
          onConfirm={handleConfirmStoryboard}
          onRegenerate={() => handleGenerateStoryboard(prompt)}
          startFrame={startFrame}
          endFrame={endFrame}
        />
      )}
      {isFrameSelectorOpen && (
        <VideoFrameSelectorModal
          isOpen={!!isFrameSelectorOpen}
          onClose={() => setIsFrameSelectorOpen(null)}
          onConfirm={isFrameSelectorOpen.onConfirm}
        />
      )}
      {imageGenerationTarget && (
        <ImageGenerationModal
          isOpen={!!imageGenerationTarget}
          onClose={() => setImageGenerationTarget(null)}
          onConfirm={(img) => {
            if (imageGenerationTarget === 'start') setStartFrame(img);
            if (imageGenerationTarget === 'end') setEndFrame(img);
            setImageGenerationTarget(null);
          }}
          generateImageFn={(p) => generateImageFromText(p, activeDogma)}
        />
      )}
      {isBananaOpen && (
        <ImageGenerationModal
          isOpen={isBananaOpen}
          onClose={() => setIsBananaOpen(false)}
          onConfirm={(img) => {
            onAssistantImageChange(img);
            setIsBananaOpen(false);
          }}
          generateImageFn={(p) => generateImageFromText(p, activeDogma)}
        />
      )}
      {videoForAnalysis && (
        <VideoAnalysisModal
          videoFile={videoForAnalysis}
          onClose={() => setVideoForAnalysis(null)}
          onConfirm={handleAnalysisConfirm}
        />
      )}

      {/* New Header with Tabs */}
      <header className="flex flex-col border-b border-gray-700 flex-shrink-0">
        <div className="p-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">
            {extensionContext || assistantReferenceVideo
              ? 'Extension Assistant'
              : 'Creative Hub'}
          </h3>
          {(extensionContext ||
            assistantReferenceVideo ||
            initialValues) && (
              <button
                onClick={onClearContext}
                title="Clear the current context and start a new project"
                className="text-sm text-indigo-400 hover:underline">
                Start Over
              </button>
            )}
        </div>
        <div className="flex px-4 gap-4">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'assistant'
              ? 'text-white border-indigo-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="w-4 h-4" />
              Assistant
            </div>
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'studio'
              ? 'text-white border-indigo-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontalIcon className="w-4 h-4" />
              Studio
            </div>
          </button>
        </div>
      </header>

      {/* Content Area based on Tab */}
      <div className="flex-grow p-4 flex flex-col gap-4 overflow-y-auto">

        {activeTab === 'assistant' ? (
          <>
            {referenceVideoUrl && (
              <div className="mb-2 p-2 bg-gray-900/50 rounded-lg border border-gray-700 flex-shrink-0">
                <h4 className="text-xs text-center font-semibold text-gray-400 mb-2">
                  Votre Vidéo de Référence
                </h4>
                <video
                  src={referenceVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full rounded-md aspect-video object-cover"
                />
              </div>
            )}

            <div className="flex-grow space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl flex flex-col gap-2 ${msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-gray-700 text-gray-200 rounded-bl-none'
                      }`}>
                    {msg.image && (
                      <img
                        src={URL.createObjectURL(msg.image.file)}
                        alt="Context"
                        className="rounded-lg max-w-xs border-2 border-indigo-500/50"
                      />
                    )}
                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isLoading && !finalResult && (
              <div className="flex justify-start">
                <div className="p-3 rounded-2xl bg-gray-700 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            {finalResult && (
              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">
                      Creative Brief
                    </h4>
                    <p className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                      {finalResult.creativePrompt}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-green-400 mb-1">
                      VEO Optimized Prompt
                    </h4>
                    <p className="text-sm text-indigo-300 bg-gray-800/50 p-2 rounded-md">
                      {finalResult.veoOptimizedPrompt}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAcceptFinalPrompt}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 text-center py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:bg-gray-600 disabled:cursor-wait">
                  {isLoading && (
                    <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                  )}
                  {isLoading
                    ? 'Processing...'
                    : parseInt(duration, 10) > 8
                      ? 'Generate Sequence'
                      : 'Continue to Configuration'}
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        ) : (
          /* Studio Tab Content - Empty here as content is in the form below, or could be help text */
          <div className="flex-grow flex items-center justify-center text-gray-500">
            <p>Configure your video settings below manually.</p>
          </div>
        )}

      </div>

      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        {activeTab === 'studio' ? renderConfigurationForm() : renderChatForm()}
        {error && (
          <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
        )}
        {storyboardError && (
          <p className="text-xs text-red-400 mt-2 text-center">{storyboardError}</p>
        )}
      </div>
    </div>
  );
};

export default PromptSequenceAssistant;