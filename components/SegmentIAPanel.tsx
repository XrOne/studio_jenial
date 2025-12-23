/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SegmentIAPanel - Right-side panel for segment editing
 * Shows prompt, keyframes, editing tools, and version history
 */
'use client';

import * as React from 'react';
import {
  SegmentIAPanelProps,
  SegmentWithUI,
  SegmentRevision
} from '../types/timeline';

type TabId = 'prompt' | 'keyframes' | 'edit-image' | 'edit-video' | 'versions';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'keyframes', label: 'Keyframes' },
  { id: 'edit-image', label: 'Édition (Image)' },
  { id: 'edit-video', label: 'Édition (Vidéo)' },
  { id: 'versions', label: 'Versions' },
];

/**
 * SegmentIAPanel
 * 
 * Panel displayed on the right side when a segment is selected.
 * Provides tools for:
 * - Re-prompting (generate new iteration)
 * - Viewing/editing keyframes
 * - Image editing (Nano integration)
 * - Video editing parameters
 * - Version history
 */
export default function SegmentIAPanel({
  segment,
  activeRevision,
  activeTab,
  onTabChange,
  onReprompt,
  onRegenerate,
}: SegmentIAPanelProps) {

  const [promptValue, setPromptValue] = React.useState('');

  // Update prompt value when segment changes
  React.useEffect(() => {
    if (activeRevision) {
      setPromptValue(activeRevision.promptJson.rootPrompt);
    }
  }, [activeRevision?.id]);

  const handleReprompt = () => {
    if (promptValue.trim() && promptValue !== activeRevision?.promptJson.rootPrompt) {
      onReprompt(promptValue);
    }
  };

  if (!segment) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
        <div className="text-center text-gray-500">
          <span className="text-3xl block mb-3">📝</span>
          <p>Sélectionnez un segment pour voir ses détails</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[320px] h-full bg-[#1e1e1e] border-l border-[#333]">
      {/* Header */}
      <div className="flex items-center justify-between p-2 px-3 bg-[#1a1a1a] border-bottom border-[#333]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-400 text-sm">edit_note</span>
          <h3 className="font-semibold text-[10px] text-gray-200 uppercase tracking-widest font-display">IA PANEL</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-xs text-gray-500 cursor-pointer hover:text-white">north</span>
          <span className="material-symbols-outlined text-xs text-gray-400 cursor-pointer hover:text-white">south</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-[#333]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-2.5 py-1.5 text-[11px] rounded transition-all border border-[#333] ${activeTab === tab.id ? 'bg-indigo-500 border-indigo-500 text-white' : 'text-gray-500 hover:border-indigo-400 hover:text-white'}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Prompt Tab */}
        {activeTab === 'prompt' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">ROOT PROMPT</label>
              <span className="material-symbols-outlined text-xs text-gray-500 cursor-pointer hover:text-indigo-400">tune</span>
            </div>
            <textarea
              className="w-full p-2.5 text-xs bg-[#2a2a2a] border border-[#333] rounded text-white resize-vertical min-h-[80px] focus:outline-none focus:border-indigo-500"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder="Décrivez le plan..."
              rows={4}
            />

            {activeRevision?.promptJson.dogmaId && (
              <>
                <div className="flex items-center justify-between mt-2 mb-1">
                  <label className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">DOGMA</label>
                  <span className="material-symbols-outlined text-xs text-gray-500 cursor-pointer hover:text-indigo-400">tune</span>
                </div>
                <div className="inline-block px-2 py-1 bg-indigo-900/30 rounded text-[11px] text-indigo-400">
                  {activeRevision.promptJson.dogmaId}
                </div>
              </>
            )}

            <div className="flex gap-2 mt-2">
              <button
                className="flex-1 px-3 py-2 text-[11px] bg-transparent border border-[#333] text-white rounded hover:border-indigo-500 transition-all disabled:opacity-50"
                onClick={onRegenerate}
                disabled={!activeRevision}
              >
                Régénérer
              </button>
              <button
                className="flex-1 px-3 py-2 text-[11px] bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all disabled:opacity-50"
                onClick={handleReprompt}
                disabled={promptValue === activeRevision?.promptJson.rootPrompt}
              >
                Créer variation
              </button>
            </div>
          </div>
        )}

        {/* Keyframes Tab */}
        {activeTab === 'keyframes' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 text-center py-6">
              Keyframes extraites de la version active
            </p>
          </div>
        )}

        {/* Edit Image Tab */}
        {activeTab === 'edit-image' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 text-center py-6">
              Retouche d'image avec Nano
            </p>
          </div>
        )}

        {/* Edit Video Tab */}
        {activeTab === 'edit-video' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 text-center py-6">
              Paramètres de la vidéo (durée, vitesse...)
            </p>
          </div>
        )}

        {/* Versions Tab */}
        {activeTab === 'versions' && (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] text-gray-500 mb-2">
              {segment.revisions?.length || 0} version(s)
            </p>
            <div className="flex flex-col gap-2">
              {segment.revisions?.map((iter, index) => (
                <div
                  key={iter.id}
                  className={`flex items-center gap-2 p-2 bg-[#2a2a2a] rounded text-[11px] border ${iter.id === segment.activeRevisionId ? 'border-green-500/50' : 'border-transparent'}`}
                >
                  <span className="font-bold text-white">v{index + 1}</span>
                  <span className="text-indigo-400">{iter.provider}</span>
                  <span className="text-gray-500">{iter.status}</span>
                  <span className="ml-auto text-gray-600">
                    {new Date(iter.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
