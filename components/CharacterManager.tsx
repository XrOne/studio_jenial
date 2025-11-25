/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useEffect, useRef, useState} from 'react';
import {generateCharacterImage, generateSpeech} from '../services/geminiService';
import {Character, CharacterImage, ImageFile} from '../types';
import {
  CheckIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
  WaveformIcon,
  XMarkIcon,
} from './icons';
import {fileToBase64} from './PromptForm';

const PREDEFINED_VIEWS = ['Vue de Face', 'Vue de Profil', 'Vue de Dos'];
const PREDEFINED_VOICES = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'];

interface CharacterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  onSaveCharacter: (character: Omit<Character, 'id'> & {id?: string}) => void;
  onDeleteCharacter: (characterId: string) => void;
  onUseCharacter: (character: Character) => void;
}

// --- Audio Helper Functions ---

/**
 * Decodes a base64 string into a Uint8Array.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates a WAV file Blob from raw PCM audio data.
 * @param pcmData The raw audio data.
 * @returns A Blob representing a playable WAV file.
 */
function createWavBlob(pcmData: Uint8Array): Blob {
  const sampleRate = 24000; // Gemini TTS sample rate
  const numChannels = 1;
  const bitsPerSample = 16;

  const dataSize = pcmData.length;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // 44 bytes for the WAV header
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  new Uint8Array(buffer, 44).set(pcmData);

  return new Blob([view], {type: 'audio/wav'});
}

const CharacterManager: React.FC<CharacterManagerProps> = ({
  isOpen,
  onClose,
  characters,
  onSaveCharacter,
  onDeleteCharacter,
  onUseCharacter,
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null,
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<CharacterImage[]>([]);
  const [imageLoadingStates, setImageLoadingStates] = useState<
    Record<string, boolean>
  >({});
  const [isGeneratingTrio, setIsGeneratingTrio] = useState(false);
  const [voiceName, setVoiceName] = useState(PREDEFINED_VOICES[0]);
  const [sampleText, setSampleText] = useState(
    "Bonjour, c'est un test pour ma voix.",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (isOpen && selectedCharacter) {
      setName(selectedCharacter.name);
      setDescription(selectedCharacter.description);
      setImages(selectedCharacter.images);
      setVoiceName(selectedCharacter.voiceName ?? PREDEFINED_VOICES[0]);
      setSampleText(
        selectedCharacter.sampleText ??
          "Bonjour, c'est un test pour ma voix.",
      );
      setAudioUrl(null); // Reset audio player on character change
    } else {
      setName('');
      setDescription('');
      setImages([]);
      setVoiceName(PREDEFINED_VOICES[0]);
      setSampleText("Bonjour, c'est un test pour ma voix.");
      setAudioUrl(null);
    }
  }, [isOpen, selectedCharacter]);

  // Effect to clean up the generated audio object URL to prevent memory leaks.
  useEffect(() => {
    const currentUrl = audioUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [audioUrl]);

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
  };

  const handleNewCharacter = () => {
    setSelectedCharacter(null);
    setName('Nouveau Personnage');
    setDescription('');
    setImages([]);
    setVoiceName(PREDEFINED_VOICES[0]);
    setSampleText("Bonjour, c'est un test pour ma voix.");
    setAudioUrl(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Le nom du personnage ne peut pas être vide.');
      return;
    }
    onSaveCharacter({
      id: selectedCharacter?.id,
      name,
      description,
      images,
      voiceName,
      sampleText,
    });
    if (!selectedCharacter) {
      handleNewCharacter();
    }
  };

  const handleDelete = () => {
    if (
      selectedCharacter &&
      confirm(`Êtes-vous sûr de vouloir supprimer "${selectedCharacter.name}"?`)
    ) {
      onDeleteCharacter(selectedCharacter.id);
      setSelectedCharacter(null);
    }
  };

  const handleGenerateImage = async (viewLabel: string) => {
    setImageLoadingStates((prev) => ({...prev, [viewLabel]: true}));
    try {
      const contextImagesForGeneration = images
        .filter((img) => img.label !== viewLabel)
        .map((img) => {
          const byteString = atob(img.base64);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], {type: img.type});
          return {
            file: new File([blob], img.name, {type: img.type}),
            base64: img.base64,
          };
        });

      let prompt;
      if (contextImagesForGeneration.length === 0) {
        prompt = `Générez une image photoréaliste de haute qualité de "${name}" (${description}) pour une "${viewLabel}". C'est la première image, elle servira de référence pour les autres.`;
      } else {
        prompt = `En vous basant sur les images de référence fournies pour "${name}" (${description}), générez une nouvelle image photoréaliste du même personnage sous l'angle "${viewLabel}". La nouvelle image doit montrer le personnage de dos, mais la cohérence du corps, des cheveux et des vêtements avec les images de face et de profil est absolument cruciale.`;
      }

      const newImageFile = await generateCharacterImage(
        prompt,
        contextImagesForGeneration,
        null,
      );

      const newCharImage: CharacterImage = {
        name: newImageFile.file.name,
        type: newImageFile.file.type,
        base64: newImageFile.base64,
        label: viewLabel,
      };

      setImages((prev) => {
        const existingIndex = prev.findIndex((img) => img.label === viewLabel);
        if (existingIndex > -1) {
          const updated = [...prev];
          updated[existingIndex] = newCharImage;
          return updated;
        }
        return [...prev, newCharImage];
      });
    } catch (error) {
      console.error(
        `Erreur lors de la génération de l'image pour ${viewLabel}:`,
        error,
      );
      alert(
        `Impossible de générer l'image pour ${viewLabel}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      setImageLoadingStates((prev) => ({...prev, [viewLabel]: false}));
    }
  };

  const handleGenerateTrio = async () => {
    if (!name || !description) {
      alert("Veuillez renseigner un nom et une description avant de générer.");
      return;
    }

    setIsGeneratingTrio(true);
    // Set all specific loading states to true
    const allLoading = PREDEFINED_VIEWS.reduce((acc, view) => ({...acc, [view]: true}), {});
    setImageLoadingStates(allLoading);

    try {
      // We launch 3 parallel requests. Since we don't have existing images, 
      // we rely on the description strictly for all three.
      // To ensure consistency, we define a shared prompt base.
      const basePrompt = `Character Reference Sheet generation for: ${name}. Description: ${description}. Style: Photorealistic, Cinematic, 8k, neutral grey studio background. Consistency is key.`;

      const promises = PREDEFINED_VIEWS.map(async (viewLabel) => {
        let angleInstruction = "";
        if (viewLabel === 'Vue de Face') angleInstruction = "Full body shot, Front View.";
        if (viewLabel === 'Vue de Profil') angleInstruction = "Full body shot, Side Profile View.";
        if (viewLabel === 'Vue de Dos') angleInstruction = "Full body shot, Back View.";
        
        const prompt = `${basePrompt} ${angleInstruction}`;
        
        // No context images passed for the initial Trio generation to ensure they don't conflict
        const newImageFile = await generateCharacterImage(prompt, [], null);
        
        return {
          name: newImageFile.file.name,
          type: newImageFile.file.type,
          base64: newImageFile.base64,
          label: viewLabel,
        } as CharacterImage;
      });

      const results = await Promise.all(promises);
      
      setImages(results);

    } catch (error) {
      console.error("Erreur lors de la génération Banana Pro Trio:", error);
      alert("Erreur lors de la génération du pack complet.");
    } finally {
      setIsGeneratingTrio(false);
      setImageLoadingStates({});
    }
  };

  const handleImageUpload = (imageFile: ImageFile, viewLabel: string) => {
    const newCharImage: CharacterImage = {
      name: imageFile.file.name,
      type: imageFile.file.type,
      base64: imageFile.base64,
      label: viewLabel,
    };
    setImages((prev) => {
      const existingIndex = prev.findIndex((img) => img.label === viewLabel);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = newCharImage;
        return updated;
      }
      return [...prev, newCharImage];
    });
  };

  const handleGenerateVoice = async () => {
    if (!sampleText.trim() || !voiceName) return;
    setIsGeneratingAudio(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl); // Clean up previous URL
    }
    setAudioUrl(null);
    try {
      const audioBase64 = await generateSpeech(sampleText, voiceName);
      const pcmData = decode(audioBase64);
      const wavBlob = createWavBlob(pcmData);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
    } catch (error) {
      console.error('Erreur lors de la génération de la voix:', error);
      alert(
        `Impossible de générer la voix: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    viewLabel: string,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToBase64<ImageFile>(file);
        handleImageUpload(imageFile, viewLabel);
      } catch (error) {
        console.error('Erreur de conversion de fichier:', error);
      }
    }
    if (e.target) e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-indigo-400" />
            Character Library
          </h2>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-grow flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-1/3 max-w-xs bg-gray-900/50 p-4 border-r border-gray-700 flex flex-col">
            <button
              onClick={handleNewCharacter}
              title="Create a new character from scratch"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
              <PlusIcon className="w-5 h-5" />
              Nouveau Personnage
            </button>
            <div className="overflow-y-auto flex-grow">
              <ul className="space-y-2">
                {characters.map((character) => (
                  <li key={character.id}>
                    <button
                      onClick={() => handleSelectCharacter(character)}
                      title={`Edit ${character.name}`}
                      className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-colors ${
                        selectedCharacter?.id === character.id
                          ? 'bg-indigo-600/30'
                          : 'hover:bg-gray-700'
                      }`}>
                      <span className="font-medium text-gray-200 truncate pr-2">
                        {character.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main Editor */}
          <main className="flex-grow p-6 flex flex-col gap-4 overflow-y-auto">
            {selectedCharacter === undefined ? (
              <div className="flex-grow flex items-center justify-center text-center text-gray-500">
                <div>
                  <h3 className="text-2xl">Sélectionnez un personnage</h3>
                  <p>Ou créez-en un nouveau pour commencer.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom du Personnage"
                    className="flex-grow bg-transparent text-2xl font-bold text-white focus:outline-none"
                    title="Character Name"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedCharacter && (
                      <button
                        onClick={() => onUseCharacter(selectedCharacter)}
                        title="Inject this character into the Prompt Assistant"
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
                        <CheckIcon className="w-5 h-5" />
                        Utiliser le Personnage
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      title="Save changes to this character"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                      Sauvegarder
                    </button>
                    {selectedCharacter && (
                      <button
                        onClick={handleDelete}
                        className="p-2.5 bg-red-800/80 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Supprimer le Personnage">
                        <Trash2Icon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="char-desc"
                    className="text-sm font-semibold mb-2 text-gray-400 block">
                    Description / Mots-clés
                  </label>
                  <textarea
                    id="char-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: yeux verts, cicatrice sur le sourcil gauche, porte une veste en cuir..."
                    className="w-full h-24 bg-[#1f1f1f] border border-gray-600 rounded-lg p-3 resize-y focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                    title="Describe the character's key visual features for the AI."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="text-sm font-semibold text-gray-400">
                        Images de Référence
                     </h3>
                     <button
                        onClick={handleGenerateTrio}
                        disabled={isGeneratingTrio || !name || !description}
                        className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGeneratingTrio ? (
                            <>
                             <div className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                             Génération 3.0...
                            </>
                        ) : (
                            <>
                             <SparklesIcon className="w-3 h-3" />
                             Générer Pack Complet (Banana Pro)
                            </>
                        )}
                     </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6 p-4 bg-[#1f1f1f] border border-gray-600 rounded-lg relative">
                    {isGeneratingTrio && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-10 rounded-lg pointer-events-none" />
                    )}
                    {PREDEFINED_VIEWS.map((view) => {
                      const image = images.find((i) => i.label === view);
                      const isLoading = imageLoadingStates[view];
                      return (
                        <div
                          key={view}
                          className="flex flex-col gap-2 items-center z-0">
                          <h4 className="text-xs font-bold uppercase text-gray-500">
                            {view}
                          </h4>
                          <div className="w-40 h-52 bg-gray-700/50 rounded-md flex items-center justify-center relative p-1 border border-gray-700">
                            {image && !isLoading && (
                              <img
                                src={`data:${image.type};base64,${image.base64}`}
                                alt={view}
                                className="w-full h-full object-contain rounded-sm"
                              />
                            )}
                            {isLoading && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80">
                                  <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-2"></div>
                                  <span className="text-[10px] text-indigo-300 animate-pulse">Rendering...</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                fileInputsRef.current[view]?.click()
                              }
                              disabled={isLoading}
                              title={`Upload an image for ${view}`}
                              className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors disabled:opacity-50">
                              Uploader
                            </button>
                            <input
                              type="file"
                              ref={(el) => { fileInputsRef.current[view] = el; }}
                              onChange={(e) => handleFileChange(e, view)}
                              accept="image/*"
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleGenerateImage(view)}
                              disabled={isLoading}
                              title={`Generate an image for ${view} using AI`}
                              className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50">
                              Générer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Voice Identity Section */}
                <div className="mt-2">
                  <h3 className="text-sm font-semibold mb-2 text-gray-400 flex items-center gap-2">
                    <WaveformIcon className="w-4 h-4" />
                    Identité Vocale
                  </h3>
                  <div className="p-4 bg-[#1f1f1f] border border-gray-600 rounded-lg flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full">
                      <label
                        htmlFor="voice-select"
                        className="text-xs font-medium text-gray-500 block mb-1">
                        Voix
                      </label>
                      <select
                        id="voice-select"
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        className="w-full bg-gray-700 p-2 rounded-md border border-gray-500"
                        title="Select a pre-built AI voice">
                        {PREDEFINED_VOICES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 w-full">
                      <label
                        htmlFor="sample-text"
                        className="text-xs font-medium text-gray-500 block mb-1">
                        Texte d'échantillon
                      </label>
                      <textarea
                        id="sample-text"
                        value={sampleText}
                        onChange={(e) => setSampleText(e.target.value)}
                        className="w-full h-12 bg-gray-700 p-2 rounded-md resize-none border border-gray-500"
                        title="Text for the AI to speak for the preview"
                      />
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <button
                        onClick={handleGenerateVoice}
                        disabled={isGeneratingAudio}
                        title="Generate and preview the selected voice"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-wait w-full">
                        {isGeneratingAudio
                          ? 'Génération...'
                          : 'Générer & Pré-écouter'}
                      </button>
                      {audioUrl && (
                        <audio
                          src={audioUrl}
                          controls
                          className="h-8 w-full"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default CharacterManager;