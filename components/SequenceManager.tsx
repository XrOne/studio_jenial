/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import {PromptSequence, SequenceVideoData} from '../types';
import {CheckIcon, PencilIcon, XMarkIcon} from './icons';

interface SequenceManagerProps {
  sequence: PromptSequence;
  activePromptIndex: number | null;
  onSelectPrompt: (prompt: string, index: number) => void;
  onClearSequence: () => void;
  onEditRequest: (index: number, prompt: string, thumbnail?: string) => void;
  revisingFromIndex: number | null;
  videoData: Record<number, SequenceVideoData>;
}

const SequenceManager: React.FC<SequenceManagerProps> = ({
  sequence,
  activePromptIndex,
  onSelectPrompt,
  onClearSequence,
  onEditRequest,
  revisingFromIndex,
  videoData,
}) => {
  const allPrompts = [sequence.mainPrompt, ...sequence.extensionPrompts];

  return (
    <div className="bg-[#1f1f1f] border border-gray-700 rounded-2xl p-4 h-full flex flex-col shadow-lg">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-white">Prompt Sequence</h3>
        <button
          onClick={onClearSequence}
          className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400"
          aria-label="Clear sequence">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-grow pr-2 -mr-2">
        <ul className="space-y-3">
          {allPrompts.map((prompt, index) => {
            const isMain = index === 0;
            const isActive = index === activePromptIndex;
            const isDone = videoData[index] !== undefined;
            const isRevising =
              revisingFromIndex !== null && index > revisingFromIndex;
            const videoThumbnail = videoData[index]?.thumbnail;

            return (
              <li
                key={index}
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  isDone
                    ? 'bg-green-900/20 border-green-500/60'
                    : isActive 
                        ? 'bg-gray-800 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' 
                        : 'bg-gray-800 border-gray-700/50'
                } ${isRevising ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <div className="w-6 h-6 flex-shrink-0 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div
                        className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center font-bold transition-colors border-2 ${
                          isActive
                            ? 'bg-red-500 border-red-600 text-white animate-pulse'
                            : 'bg-gray-700 border-gray-600 text-gray-400'
                        }`}>
                        {index + 1}
                      </div>
                    )}
                    <h4 className={`font-semibold ${isDone ? 'text-green-400' : 'text-gray-300'}`}>
                      {isMain ? 'Main Prompt' : `Extension ${index}`}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() =>
                        onEditRequest(index, prompt, videoThumbnail)
                      }
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 p-1.5 rounded-md transition-colors border border-gray-600"
                      title="Edit Prompt"
                      aria-label="Edit prompt">
                      <PencilIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onSelectPrompt(prompt, index)}
                      className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${
                         isActive ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
                      }`}>
                      Use
                    </button>
                  </div>
                </div>
                <div className="pl-8 mt-2">
                  <p className="text-sm text-gray-400 bg-gray-900/50 p-2 rounded-md whitespace-pre-wrap break-words border border-gray-700/50">
                    {prompt}
                  </p>
                </div>
                {videoThumbnail ? (
                  <div className="pl-8 mt-2">
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-600 shadow-lg group">
                        <img
                        src={`data:image/jpeg;base64,${videoThumbnail}`}
                        alt={`Preview for prompt ${index + 1}`}
                        className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs text-white font-semibold bg-black/60 px-2 py-1 rounded">Preview</span>
                        </div>
                    </div>
                  </div>
                ) : (
                    // Placeholder for missing thumbnail if expected
                    isDone && (
                        <div className="pl-8 mt-2">
                            <div className="w-full aspect-video bg-gray-900 rounded-md flex items-center justify-center border border-gray-700 border-dashed">
                                <span className="text-xs text-gray-600">No Thumbnail</span>
                            </div>
                        </div>
                    )
                )}
                {isRevising && (
                  <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center rounded-lg backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <div className="w-4 h-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                      <span className="text-sm font-semibold">Revising...</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-gray-500 mt-4 flex-shrink-0 text-center border-t border-gray-700 pt-2">
        Green = Completed. Red = Next to generate.
      </p>
    </div>
  );
};

export default SequenceManager;