/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useState} from 'react';
import {ImageFile} from '../types';
import {ArrowRightIcon, MagicWandIcon, XMarkIcon} from './icons';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (imageFile: ImageFile) => void;
  generateImageFn: (prompt: string) => Promise<ImageFile>;
}

const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  generateImageFn,
}) => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<ImageFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);
    try {
      const result = await generateImageFn(prompt);
      setGeneratedImage(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (generatedImage) {
      onConfirm(generatedImage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <MagicWandIcon className="w-6 h-6 text-indigo-400" />
            Generate Image with AI
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A futuristic castle floating in the clouds..."
            className="flex-grow bg-transparent focus:outline-none text-base text-gray-200 placeholder-gray-500 px-2"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="p-2.5 bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
            aria-label="Generate Image">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            ) : (
              <ArrowRightIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
              <span>Generating...</span>
            </div>
          )}
          {error && <p className="text-red-400">{error}</p>}
          {generatedImage && (
            <img
              src={URL.createObjectURL(generatedImage.file)}
              alt="Generated image"
              className="max-w-full max-h-full object-contain rounded"
            />
          )}
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!generatedImage || isLoading}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
            Use This Image
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerationModal;