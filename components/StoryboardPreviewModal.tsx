/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {useEffect, useState} from 'react';
import {ImageFile, Storyboard} from '../types';
import {ArrowPathIcon, CheckIcon, PencilIcon, XMarkIcon} from './icons';

interface StoryboardPreviewModalProps {
  storyboard: Storyboard;
  onClose: () => void;
  onConfirm: (storyboard: Storyboard) => void;
  onRegenerate: () => void;
  startFrame?: ImageFile | null;
  endFrame?: ImageFile | null;
}

const StoryboardPreviewModal: React.FC<StoryboardPreviewModalProps> = ({
  storyboard,
  onClose,
  onConfirm,
  onRegenerate,
  startFrame,
  endFrame,
}) => {
  const [editableStoryboard, setEditableStoryboard] =
    useState<Storyboard>(storyboard);

  useEffect(() => {
    // Create a deep copy to avoid mutating the original prop
    const newStoryboard = JSON.parse(JSON.stringify(storyboard)) as Storyboard;
    let modified = false;

    if (startFrame && newStoryboard.keyframes.length > 0) {
      newStoryboard.keyframes[0].imageBase64 = startFrame.base64;
      modified = true;
    }
    if (endFrame && newStoryboard.keyframes.length > 2) {
      newStoryboard.keyframes[newStoryboard.keyframes.length - 1].imageBase64 =
        endFrame.base64;
      modified = true;
    }

    if (modified) {
      setEditableStoryboard(newStoryboard);
    } else {
      setEditableStoryboard(storyboard);
    }
  }, [storyboard, startFrame, endFrame]);

  const handleDescriptionChange = (index: number, newDescription: string) => {
    setEditableStoryboard((prev) => {
      const newKeyframes = [...prev.keyframes];
      newKeyframes[index] = {...newKeyframes[index], description: newDescription};
      return {...prev, keyframes: newKeyframes};
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-7xl h-[90vh] p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Storyboard Preview</h2>
            <p className="text-gray-400 text-sm max-w-2xl truncate">
              Review and edit the AI's plan for: "{storyboard.prompt}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow flex items-center justify-center overflow-x-auto overflow-y-hidden py-4">
          <div className="flex gap-6 px-4">
            {editableStoryboard.keyframes.map((frame, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 w-80 flex-shrink-0">
                <div className="aspect-video bg-black rounded-lg overflow-hidden border-2 border-gray-700">
                  <img
                    src={`data:image/png;base64,${frame.imageBase64}`}
                    alt={`Keyframe ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white">
                    {frame.timestamp}
                  </h3>
                  <textarea
                    value={frame.description}
                    onChange={(e) =>
                      handleDescriptionChange(index, e.target.value)
                    }
                    className="w-full h-24 bg-gray-900/50 text-sm text-gray-400 leading-snug p-2 rounded-md resize-none border border-transparent focus:border-indigo-500 focus:outline-none transition-colors"
                    aria-label={`Description for keyframe ${index + 1}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center gap-4 flex-shrink-0 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
            <PencilIcon className="w-5 h-5" />
            Refine Prompt
          </button>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
            <ArrowPathIcon className="w-5 h-5" />
            Retry
          </button>
          <button
            onClick={() => onConfirm(editableStoryboard)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
            <CheckIcon className="w-5 h-5" />
            Confirm & Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryboardPreviewModal;