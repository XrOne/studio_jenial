/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { PromptSequence, PromptSequenceStatus, SequenceVideoData } from '../types';
import { CheckIcon, PencilIcon, XMarkIcon } from './icons';

// Refresh icon for regenerate action
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

interface SequenceManagerProps {
  sequence: PromptSequence;
  activePromptIndex: number | null;
  onSelectPrompt: (prompt: string, index: number) => void;
  onClearSequence: () => void;
  onEditRequest: (index: number, prompt: string, thumbnail?: string) => void;
  revisingFromIndex: number | null;
  videoData: Record<number, SequenceVideoData>;
  // Guardrail 3: Track generation state
  isGenerating?: boolean;
  generatingIndex?: number | null;
  // NEW: Callback for regenerating dirty extensions
  onRegenerateExtensions?: () => void;
  // NEW: Callback for Nano Banana Pro integration - click on thumbnail
  onThumbnailClick?: (thumbnailBase64: string, index: number) => void;
}

const SequenceManager: React.FC<SequenceManagerProps> = ({
  sequence,
  activePromptIndex,
  onSelectPrompt,
  onClearSequence,
  onEditRequest,
  revisingFromIndex,
  videoData,
  isGenerating = false,
  generatingIndex = null,
  onRegenerateExtensions,
  onThumbnailClick,
}) => {
  const allPrompts = [sequence.mainPrompt, ...sequence.extensionPrompts];

  // Check if sequence has dirty extensions
  const hasDirtyExtensions = sequence.status === PromptSequenceStatus.ROOT_MODIFIED ||
    sequence.status === PromptSequenceStatus.EXTENSIONS_DIRTY;
  const dirtyIndices = new Set(sequence.dirtyExtensions || []);

  return (
    <div className="bg-[#1f1f1f] border border-gray-700 rounded-2xl p-4 h-full flex flex-col shadow-lg">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Prompt Sequence</h3>
          {/* Dirty state indicator */}
          {hasDirtyExtensions && (
            <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full animate-pulse">
              ⚠️ {sequence.dirtyExtensions?.length || 0} dirty
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Regenerate button when extensions are dirty */}
          {hasDirtyExtensions && onRegenerateExtensions && (
            <button
              onClick={onRegenerateExtensions}
              className="p-1.5 rounded-full hover:bg-orange-900/50 text-orange-400 border border-orange-500/30"
              aria-label="Regenerate extensions"
              title="Régénérer les extensions">
              <RefreshIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClearSequence}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400"
            aria-label="Clear sequence">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
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

            // NEW: Check if this extension is dirty
            const isDirty = !isMain && dirtyIndices.has(index - 1); // dirtyExtensions uses 0-indexed for extensions

            // GUARDRAIL 3: Determine if this prompt can be selected
            // - Root shot (index 0) can always be used
            // - Extensions need the previous shot to be done
            // - Cannot use if that index is currently generating
            // - Cannot use dirty extensions until regenerated
            const previousDone = isMain || videoData[index - 1] !== undefined;
            const isCurrentlyGenerating = isGenerating && generatingIndex === index;
            const isPreviousGenerating = isGenerating && generatingIndex === index - 1;
            const canUse = previousDone && !isCurrentlyGenerating && !isPreviousGenerating && !isDirty;

            // Determine the reason for being disabled
            let disabledReason = '';
            if (!canUse) {
              if (isDirty) {
                disabledReason = 'Extension dirty - needs regeneration';
              } else if (isPreviousGenerating) {
                disabledReason = `Shot ${index} is generating...`;
              } else if (!previousDone) {
                disabledReason = `Generate Shot ${index} first`;
              }
            }

            return (
              <li
                key={index}
                className={`relative p-3 rounded-lg border-2 transition-all ${isDirty
                  ? 'bg-orange-900/20 border-orange-500/60'
                  : isDone
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
                    ) : isCurrentlyGenerating ? (
                      <div className="w-6 h-6 flex-shrink-0 bg-yellow-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div
                        className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center font-bold transition-colors border-2 ${isActive
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
                      onClick={() => canUse && onSelectPrompt(prompt, index)}
                      disabled={!canUse}
                      title={disabledReason || 'Use this prompt'}
                      className={`text-xs px-3 py-1 rounded-md transition-colors font-medium ${!canUse
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                        : isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
                        }`}>
                      {isPreviousGenerating ? '⏳' : 'Use'}
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
                    <button
                      onClick={() => onThumbnailClick?.(videoThumbnail, index)}
                      className="relative w-full aspect-video rounded-md overflow-hidden border border-gray-600 shadow-lg group cursor-pointer hover:border-indigo-500 transition-colors">
                      <img
                        src={`data:image/jpeg;base64,${videoThumbnail}`}
                        alt={`Preview for prompt ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="text-xs text-white font-semibold bg-indigo-600/80 px-2 py-1 rounded">🍌 Nano Banana Pro</span>
                      </div>
                    </button>
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