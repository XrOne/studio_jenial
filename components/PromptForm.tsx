/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useRef} from 'react';
import {ImageFile} from '../types';
import {PencilIcon, PlusIcon, XMarkIcon} from './icons';

// NOTE: The main PromptForm component has been merged into PromptSequenceAssistant.
// This file is kept to export helper components and functions used by other parts of the application
// to minimize file changes and keep diffs clean.

export const fileToBase64 = <T extends {file: File; base64: string}>(
  file: File,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) {
        resolve({file, base64} as T);
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: React.ReactNode;
  className?: string;
  onEditRequest?: (image: ImageFile) => void;
}> = ({
  onSelect,
  onRemove,
  image,
  label,
  className = 'w-28 h-20',
  onEditRequest,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToBase64<ImageFile>(file);
        onSelect(imageFile);
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
      <div className={`relative group ${className}`}>
        <img
          src={URL.createObjectURL(image.file)}
          alt="preview"
          className="w-full h-full object-cover rounded-lg"
        />
        <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onRemove}
            className="w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white"
            aria-label="Remove image">
            <XMarkIcon className="w-4 h-4" />
          </button>
          {onEditRequest && (
            <button
              type="button"
              onClick={() => onEditRequest(image)}
              className="w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white"
              aria-label="Edit image with AI">
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`${className} bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors`}>
      <PlusIcon className="w-6 h-6" />
      <span className="text-xs mt-1 text-center">{label}</span>
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