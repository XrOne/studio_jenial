/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {generateDogmaFromMedia} from '../services/geminiService';
import {Dogma, DogmaImage, ImageFile} from '../types';
import {
  BookMarkedIcon,
  CheckIcon,
  PlusIcon,
  Trash2Icon,
  XMarkIcon,
  SparklesIcon,
  UploadCloudIcon
} from './icons';
import {fileToBase64} from './PromptForm'; // Reusing the helper function

interface ImageUploadCompactProps {
  onSelect?: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: DogmaImage | null;
  className?: string;
}

const ImageUploadCompact: React.FC<ImageUploadCompactProps> = ({
  onSelect,
  onRemove,
  image,
  className = 'w-24 h-16',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToBase64<ImageFile>(file);
        if (onSelect) {
          onSelect(imageFile);
        }
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (image) {
    return (
      <div className={`relative group flex-shrink-0 ${className}`}>
        <img
          src={`data:${image.type};base64,${image.base64}`}
          alt={image.name}
          className="w-full h-full object-cover rounded-md"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove image">
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`${className} flex-shrink-0 bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-colors`}>
      <PlusIcon className="w-5 h-5" />
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </button>
  );
};

interface DogmaManagerProps {
  isOpen: boolean;
  onClose: () => void;
  dogmas: Dogma[];
  onSaveDogma: (dogma: Omit<Dogma, 'id'> & {id?: string}) => void;
  onDeleteDogma: (dogmaId: string) => void;
  activeDogmaId: string | null;
  onSetActiveDogmaId: (id: string | null) => void;
}

const DogmaManager: React.FC<DogmaManagerProps> = ({
  isOpen,
  onClose,
  dogmas,
  onSaveDogma,
  onDeleteDogma,
  activeDogmaId,
  onSetActiveDogmaId,
}) => {
  const [selectedDogma, setSelectedDogma] = useState<Dogma | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [referenceImages, setReferenceImages] = useState<DogmaImage[]>([]);
  
  // DNA Extractor State
  const [isExtractingDNA, setIsExtractingDNA] = useState(false);
  const dnaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && selectedDogma) {
      setTitle(selectedDogma.title);
      setText(selectedDogma.text);
      setReferenceImages(selectedDogma.referenceImages);
    } else {
      // Reset form when no dogma is selected or modal closes
      setTitle('');
      setText('');
      setReferenceImages([]);
    }
  }, [isOpen, selectedDogma]);

  const handleSelectDogma = (dogma: Dogma) => {
    setSelectedDogma(dogma);
  };

  const handleNewDogma = () => {
    setSelectedDogma(null);
    setTitle('Untitled Dogma');
    setText('');
    setReferenceImages([]);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Dogma title cannot be empty.');
      return;
    }
    onSaveDogma({
      id: selectedDogma?.id,
      title,
      text,
      referenceImages,
    });
    if (!selectedDogma) {
      handleNewDogma(); // Clear form after saving a new one
    }
  };

  const handleDelete = () => {
    if (
      selectedDogma &&
      confirm(`Are you sure you want to delete "${selectedDogma.title}"?`)
    ) {
      onDeleteDogma(selectedDogma.id);
      setSelectedDogma(null);
    }
  };

  const handleExtractDNA = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      setIsExtractingDNA(true);
      // Switch to "New Dogma" mode if editing an existing one to prevent overwrite confusion
      if(selectedDogma) handleNewDogma();

      try {
          // Convert to base64
          const { base64 } = await fileToBase64<ImageFile>(file);
          
          // Call Gemini DNA Extractor
          const result = await generateDogmaFromMedia(file, base64);
          
          setTitle(result.title);
          setText(result.text);
          // Optionally add the source image as a reference
          setReferenceImages([{
              name: file.name,
              type: file.type,
              base64: base64
          }]);

      } catch (error) {
          console.error("DNA Extraction failed:", error);
          alert("Could not extract DNA style from this media.");
      } finally {
          setIsExtractingDNA(false);
          if(dnaInputRef.current) dnaInputRef.current.value = '';
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <BookMarkedIcon className="w-6 h-6 text-indigo-400" />
            Dogma Library
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-grow flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-1/3 max-w-xs bg-gray-900/50 p-4 border-r border-gray-700 flex flex-col gap-4">
            <button
              onClick={handleNewDogma}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
              <PlusIcon className="w-5 h-5" />
              New Dogma
            </button>

            {/* DNA Extractor Button */}
            <div className="relative">
                <input 
                    type="file" 
                    ref={dnaInputRef}
                    onChange={handleExtractDNA}
                    accept="image/*,video/*"
                    className="hidden"
                />
                <button 
                    onClick={() => dnaInputRef.current?.click()}
                    disabled={isExtractingDNA}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isExtractingDNA ? (
                         <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    ) : (
                         <SparklesIcon className="w-4 h-4" />
                    )}
                    {isExtractingDNA ? "Extracting DNA..." : "Extract DNA from Media"}
                </button>
            </div>

            <div className="overflow-y-auto flex-grow">
              <ul className="space-y-2">
                {dogmas.map((dogma) => (
                  <li key={dogma.id}>
                    <button
                      onClick={() => handleSelectDogma(dogma)}
                      className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-colors ${
                        selectedDogma?.id === dogma.id
                          ? 'bg-indigo-600/30'
                          : 'hover:bg-gray-700'
                      }`}>
                      <span className="font-medium text-gray-200 truncate pr-2">
                        {dogma.title}
                      </span>
                      {activeDogmaId === dogma.id && (
                        <div
                          className="w-5 h-5 flex-shrink-0 bg-green-500 rounded-full flex items-center justify-center"
                          title="Active Dogma">
                          <CheckIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main Editor */}
          <main className="flex-grow p-6 flex flex-col gap-4 overflow-y-auto">
            {selectedDogma === undefined ? (
              <div className="flex-grow flex items-center justify-center text-center text-gray-500">
                <div>
                  <h3 className="text-2xl">Select a Dogma</h3>
                  <p>Or create a new one (or extract one from media) to get started.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-4">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Dogma Title"
                    className="flex-grow bg-transparent text-2xl font-bold text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedDogma && activeDogmaId !== selectedDogma.id && (
                      <button
                        onClick={() =>
                          onSetActiveDogmaId(selectedDogma?.id ?? null)
                        }
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
                        Activate
                      </button>
                    )}
                    {selectedDogma && activeDogmaId === selectedDogma.id && (
                      <div className="px-4 py-2 flex items-center gap-2 bg-green-600/30 text-green-300 font-semibold rounded-lg">
                        <CheckIcon className="w-5 h-5" />
                        Active
                      </div>
                    )}
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                      Save
                    </button>
                    {selectedDogma && (
                      <button
                        onClick={handleDelete}
                        className="p-2.5 bg-red-800/80 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Delete Dogma">
                        <Trash2Icon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="dogma-text"
                    className="text-sm font-semibold mb-2 text-gray-400 block">
                    System Instructions / Rules
                  </label>
                  <textarea
                    id="dogma-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your artistic rules and production workflow here..."
                    className="w-full h-64 bg-[#1f1f1f] border border-gray-600 rounded-lg p-3 resize-y focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2 text-gray-400">
                    Style Reference Image (optional, 1 max)
                  </h3>
                  <div className="flex flex-wrap gap-3 p-3 bg-[#1f1f1f] border border-gray-600 rounded-lg min-h-[80px]">
                    {referenceImages.map((img, index) => (
                      <ImageUploadCompact
                        key={index}
                        image={img}
                        onRemove={() =>
                          setReferenceImages((imgs) =>
                            imgs.filter((_, i) => i !== index),
                          )
                        }
                      />
                    ))}
                    {referenceImages.length < 1 && (
                      <ImageUploadCompact
                        onSelect={(imgFile) => {
                          const newDogmaImage: DogmaImage = {
                            name: imgFile.file.name,
                            type: imgFile.file.type || 'image/jpeg',
                            base64: imgFile.base64,
                          };
                          setReferenceImages((imgs) => [...imgs, newDogmaImage]);
                        }}
                      />
                    )}
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

export default DogmaManager;