/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useState, useEffect } from 'react';
import { KeyIcon, Trash2Icon, ShieldCheckIcon, ExternalLinkIcon } from './icons';

import { setGeminiKey, clearGeminiKey } from '../utils/runtimeKeys';
import { ThemeSwitcher } from './ThemeSwitcher';

interface ApiKeyDialogProps {
  onSetKey: (key: string) => void;
  onClearKey: () => void;
  onClose: () => void;
  hasCustomKey: boolean;
  errorMessage?: string;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({
  onSetKey,
  onClearKey,
  onClose,
  hasCustomKey,
  errorMessage
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Show parent error message if provided
  useEffect(() => {
    if (errorMessage) {
      setError(errorMessage);
    }
  }, [errorMessage]);

  const validateKey = (key: string): boolean => {
    // Basic validation: Gemini keys start with "AIzaSy" and are ~39 chars
    if (!key.startsWith('AIzaSy')) {
      setError('Invalid key format. Gemini API keys start with "AIzaSy"');
      return false;
    }
    if (key.length < 30) {
      setError('Key seems too short. Please check your API key.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSave = () => {
    const trimmedKey = apiKeyInput.trim();

    if (trimmedKey) {
      if (validateKey(trimmedKey)) {
        setGeminiKey(trimmedKey);
        onSetKey(trimmedKey);
      }
    } else if (hasCustomKey) {
      // If user clicks save but field is empty, and they ALREADY have a key, just close dialog
      onClose();
    } else {
      setError('Please enter an API Key to continue.');
    }
  };

  const handleRemove = () => {
    clearGeminiKey();
    setApiKeyInput('');
    onClearKey();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full p-8 flex flex-col items-center relative overflow-hidden">
        {/* Decorative background gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <div className="p-4 rounded-full mb-6 bg-gray-800 ring-1 ring-gray-700">
          <KeyIcon className="w-10 h-10 text-indigo-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">🎬 Studio Jenial</h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          Welcome! To use this video studio, you need your own Gemini API key with Veo access.
          <br />
          <span className="text-indigo-400">Your key = Your usage = Your costs.</span>
        </p>

        <div className="w-full bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-indigo-300 font-semibold text-sm flex items-center gap-2 mb-2">
            <ShieldCheckIcon className="w-4 h-4" />
            100% Private & Secure
          </h3>
          <ul className="text-indigo-200/70 text-xs leading-relaxed space-y-1">
            <li>✓ Key stored <strong>only in your browser</strong> (Memory/Session only)</li>
            <li>✓ Never sent to our servers or database</li>
            <li>✓ Used directly with Google's API</li>
            <li>✓ You control your own usage & billing</li>
          </ul>
        </div>

        {hasCustomKey ? (
          <div className="w-full bg-green-900/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            API Key Active - Ready to create!
          </div>
        ) : (
          <div className="w-full bg-amber-900/20 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            API Key Required to Continue
          </div>
        )}

        <div className="w-full mb-4 space-y-2">
          <label className="text-xs font-medium text-gray-500 ml-1">Your Gemini API Key</label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={hasCustomKey ? "Enter new key to replace current..." : "AIzaSy..."}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-gray-600 transition-all font-mono text-sm"
            autoFocus={!hasCustomKey}
          />
        </div>

        {/* THEME / APPARENCE */}
        <div className="w-full mb-4 border-t border-gray-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">palette</span>
              Apparence
            </span>
          </div>
          <ThemeSwitcher variant="compact" />
        </div>

        {error && (
          <div className="w-full text-red-400 text-xs mb-4 px-1">
            ⚠️ {error}
          </div>
        )}

        <div className="w-full flex gap-3 mt-4">
          {hasCustomKey && (
            <button
              onClick={handleRemove}
              className="px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              title="Remove current key"
            >
              <Trash2Icon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!apiKeyInput.trim() && !hasCustomKey}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-indigo-900/20"
          >
            {hasCustomKey ? 'Update Key' : '🚀 Start Creating'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg w-full">
          <p className="text-xs text-gray-400 text-center mb-2">
            Don't have a Gemini API key yet?
          </p>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            Get Free API Key from Google AI Studio
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            Note: You need Veo API access for video generation
          </p>
        </div>

        {hasCustomKey && (
          <button
            onClick={() => onClose()}
            className="mt-4 text-gray-500 hover:text-gray-300 text-xs hover:underline transition-colors"
          >
            Continue with current key →
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyDialog;
