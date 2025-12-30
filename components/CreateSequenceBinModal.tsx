/**
 * CreateSequenceBinModal - Modal pour créer un bin de séquence après découpage
 * 
 * Permet à l'utilisateur de nommer le dossier avant de créer les slots
 */

import React, { useState, useEffect } from 'react';
import { Dogma, ImageFile } from '../types';
import { CreateSequenceBinInput } from '../types/bins';

interface OrderedShotInput {
  shotType: string;
  prompt: string;
  duration: number;
  cameraMovement?: string;
  keyframe?: ImageFile;
}

interface CreateSequenceBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (input: CreateSequenceBinInput) => void;
  shots: OrderedShotInput[];
  dogma: Dogma | null;
  rootPrompt?: string;
  suggestedName?: string;
}

export const CreateSequenceBinModal: React.FC<CreateSequenceBinModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  shots,
  dogma,
  rootPrompt,
  suggestedName,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Generate suggested name on open
  useEffect(() => {
    if (isOpen) {
      if (suggestedName) {
        setName(suggestedName);
      } else {
        // Auto-generate name from date/time
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        setName(`Séquence ${dateStr} ${timeStr}`);
      }
      setDescription('');
    }
  }, [isOpen, suggestedName]);

  const totalDuration = shots.reduce((sum, s) => sum + s.duration, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onConfirm({
      name: name.trim(),
      description: description.trim() || undefined,
      dogma,
      rootPrompt,
      shots,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-indigo-400">create_new_folder</span>
            <h2 className="text-lg font-bold text-white">Créer le Bin de Séquence</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Preview Stats */}
          <div className="flex items-center justify-between bg-indigo-900/20 border border-indigo-600/30 rounded-lg p-3">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-400">{shots.length}</div>
                <div className="text-[10px] text-gray-500 uppercase">Plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{totalDuration}s</div>
                <div className="text-[10px] text-gray-500 uppercase">Durée</div>
              </div>
            </div>
            {dogma && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Direction Artistique</div>
                <div className="text-sm font-medium text-indigo-300">{dogma.title}</div>
              </div>
            )}
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nom du dossier <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Scène 3 - Confrontation"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              autoFocus
              required
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Ce nom apparaîtra dans le Bin Manager
            </p>
          </div>

          {/* Description Input (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description <span className="text-gray-500">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes sur cette séquence..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Shots Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Plans inclus
            </label>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {shots.map((shot, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-16 rounded overflow-hidden bg-gray-800 border border-gray-700"
                >
                  <div className="aspect-video bg-gray-900 flex items-center justify-center">
                    {shot.keyframe ? (
                      <img
                        src={`data:image/jpeg;base64,${shot.keyframe.base64}`}
                        alt={shot.shotType}
                        className="w-full h-full object-cover opacity-60"
                      />
                    ) : (
                      <span className="text-xs text-gray-600">{idx + 1}</span>
                    )}
                  </div>
                  <div className="p-0.5 text-center">
                    <div className="text-[8px] text-gray-400 truncate">{shot.shotType.split(' (')[0]}</div>
                    <div className="text-[8px] text-gray-500">{shot.duration}s</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700 bg-gray-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">create_new_folder</span>
            Créer le Bin
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSequenceBinModal;
