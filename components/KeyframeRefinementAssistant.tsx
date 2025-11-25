/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useRef, useState} from 'react';
import {regenerateSinglePrompt} from '../services/geminiService';
import {Dogma, ImageFile} from '../types';
import {ArrowPathIcon} from './icons';

interface KeyframeRefinementAssistantProps {
  keyframes: ImageFile[];
  isExtractingFrames: boolean;
  originalPrompt: string;
  dogma: Dogma | null;
  onPromptRevised: (newPrompt: string) => void;
  // The following props are no longer used by the new UI but kept for API compatibility.
  onUseFrameAsStart: (frame: ImageFile) => void;
  onEditFrame: (frame: ImageFile) => void;
}

const KeyframeRefinementAssistant: React.FC<
  KeyframeRefinementAssistantProps
> = ({
  keyframes,
  isExtractingFrames,
  originalPrompt,
  dogma,
  onPromptRevised,
}) => {
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevisionSubmit = async () => {
    setIsLoading(true);
    setError(null);
    const instruction = keyframes
      .map((_, index) => {
        const text = feedback[index];
        return text
          ? `For the moment corresponding to keyframe ${index + 1}, the desired change is: "${text}"`
          : '';
      })
      .filter(Boolean)
      .join('\n');

    if (!instruction) {
      setError('Please provide feedback in at least one text area.');
      setIsLoading(false);
      return;
    }

    try {
      // FIX: Add index to satisfy RegeneratePromptParams type. Since this component
      // revises a single prompt, a default index of 0 is appropriate.
      const revisedPrompt = await regenerateSinglePrompt({
        index: 0,
        instruction,
        promptToRevise: originalPrompt,
        dogma,
        // Visual context could be added here if needed, e.g., by combining keyframes
      });
      onPromptRevised(revisedPrompt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to revise prompt.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-md font-semibold text-center py-3 text-gray-300 border-b border-gray-700 flex-shrink-0">
        Keyframe Chronology & Revision
      </h3>

      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {isExtractingFrames ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-6 h-6 border-2 border-t-transparent border-indigo-400 rounded-full animate-spin mb-3"></div>
            <p>Combining video & extracting keyframes...</p>
          </div>
        ) : keyframes.length > 0 ? (
          keyframes.map((frame, index) => (
            <div key={index} className="flex gap-4 items-start">
              <div className="w-40 flex-shrink-0">
                <img
                  src={URL.createObjectURL(frame.file)}
                  alt={`Keyframe ${index + 1}`}
                  className="w-full aspect-video object-cover rounded-md border border-gray-600"
                />
                <p className="text-xs text-gray-500 text-center mt-1">
                  Frame {index + 1}
                </p>
              </div>
              <div className="flex-grow">
                <textarea
                  value={feedback[index] || ''}
                  onChange={(e) =>
                    setFeedback((prev) => ({...prev, [index]: e.target.value}))
                  }
                  placeholder={`Describe changes for this moment...`}
                  className="w-full h-24 bg-gray-800/80 text-sm text-gray-300 p-2 rounded-md resize-y border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No keyframes to display.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={handleRevisionSubmit}
          disabled={isLoading || Object.values(feedback).every((v) => !v)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed">
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              Revising...
            </>
          ) : (
            <>
              <ArrowPathIcon className="w-5 h-5" />
              Apply Revisions to Prompt
            </>
          )}
        </button>
        {error && (
          <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
        )}
      </div>
    </div>
  );
};

export default KeyframeRefinementAssistant;
