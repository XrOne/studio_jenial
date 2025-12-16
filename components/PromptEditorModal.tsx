/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { getRevisionAssistantResponse } from '../services/geminiService';
import { ChatMessage, Dogma, ImageFile } from '../types';
import { ArrowRightIcon, PencilIcon, SparklesIcon, XMarkIcon } from './icons';

interface PromptEditorModalProps {
  originalPrompt: string;
  visualContextBase64?: string;
  onClose: () => void;
  onConfirm: (newPrompt: string) => void;
  dogma: Dogma | null;
  promptBefore?: string;
  promptAfter?: string;
  // === NANO BANANA PRO: Visual alignment ===
  onOpenNanoEditor?: () => void;  // Callback to open Nano editor for alignment
}

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  originalPrompt,
  visualContextBase64,
  onClose,
  onConfirm,
  dogma,
  promptBefore,
  promptAfter,
  onOpenNanoEditor,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let initialImage: ImageFile | null = null;
    if (visualContextBase64) {
      // Create a dummy file for the ChatMessage structure
      const blob = new Blob(); // Content doesn't matter, just need a File object
      const file = new File([blob], 'visual_context.jpg', {
        type: 'image/jpeg',
      });
      initialImage = { file, base64: visualContextBase64 };
    }

    setMessages([
      {
        role: 'assistant',
        content: `I'm ready to help you revise this prompt segment. I see the original prompt${visualContextBase64
          ? ' and a frame from the previous video result'
          : ''
          }. What would you like to change?`,
        image: initialImage,
      },
    ]);
  }, [originalPrompt, visualContextBase64]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userInput, image: null },
    ];
    setMessages(newMessages);
    setUserInput('');
    setIsLoading(true);
    setError(null);

    try {
      const result = await getRevisionAssistantResponse({
        messages: newMessages,
        dogma,
        promptToRevise: originalPrompt,
        promptBefore,
        promptAfter,
        visualContextBase64,
      });

      if (typeof result === 'string') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: result, image: null },
        ]);
      } else if (result.isFinalRevision) {
        setFinalPrompt(result.revisedPrompt);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ I've revised the prompt based on your feedback. Here's the updated version:\n\n"${result.revisedPrompt.substring(0, 200)}..."\n\nClick "Confirm Revision" to apply this change, or continue the conversation if you'd like further adjustments.`,
            image: null,
          },
        ]);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}`,
          image: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (finalPrompt) {
      onConfirm(finalPrompt);
    }
  };

  const isSubmitDisabled = isLoading || !userInput.trim();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <PencilIcon className="w-6 h-6 text-indigo-400" />
            Revise Prompt Segment (Assistant)
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
          {/* Chat Area */}
          <div className="flex flex-col h-full bg-gray-900/50 rounded-lg border border-gray-700">
            <main className="flex-grow p-4 overflow-y-auto flex flex-col gap-4">
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
                        src={`data:image/jpeg;base64,${msg.image.base64}`}
                        alt="Context"
                        className="rounded-lg max-w-xs"
                      />
                    )}
                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </main>
            <div className="p-4 border-t border-gray-700">
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your revision instructions..."
                  className="flex-grow bg-transparent focus:outline-none text-base text-gray-200 placeholder-gray-500 px-2"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="p-2.5 bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  aria-label="Send message">
                  <ArrowRightIcon className="w-5 h-5 text-white" />
                </button>
              </form>
              {error && (
                <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
              )}
            </div>
          </div>

          {/* Prompt Preview Area */}
          <div className="flex flex-col gap-2 h-full">
            {finalPrompt ? (
              <div className="grid grid-cols-2 gap-4 flex-grow min-h-0">
                <div className="flex flex-col gap-2 min-h-0">
                  <h3 className="text-sm font-semibold text-gray-400 flex-shrink-0">
                    Original Prompt
                  </h3>
                  <div className="flex-grow bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 min-h-0">
                    <pre className="w-full h-full text-gray-400 text-xs p-2 overflow-auto whitespace-pre-wrap break-all font-mono">
                      {originalPrompt}
                    </pre>
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                  <h3 className="text-sm font-semibold text-green-400 flex-shrink-0">
                    Revised Prompt
                  </h3>
                  <div className="flex-grow bg-[#1f1f1f] border border-green-600/50 rounded-lg p-2 min-h-0">
                    <pre className="w-full h-full text-indigo-300 text-xs p-2 overflow-auto whitespace-pre-wrap break-all font-mono">
                      {finalPrompt}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-400 flex-shrink-0">
                  Original Prompt
                </h3>
                <div className="flex-grow bg-[#1f1f1f] border border-gray-600 rounded-lg p-2 min-h-0">
                  <pre className="w-full h-full text-indigo-300 text-xs p-2 overflow-auto whitespace-pre-wrap break-all font-mono">
                    {originalPrompt}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center gap-4 flex-shrink-0 pt-4 border-t border-gray-700">
          {/* Left side: Nano alignment button */}
          <div>
            {onOpenNanoEditor && visualContextBase64 && (
              <button
                onClick={onOpenNanoEditor}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-orange-900/20"
              >
                <SparklesIcon className="w-4 h-4" />
                Aligner au visuel (Nano)
              </button>
            )}
          </div>

          {/* Right side: Cancel and Confirm */}
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!finalPrompt || isLoading}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
              Confirm Revision
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditorModal;