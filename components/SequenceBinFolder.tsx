/**
 * SequenceBinFolder - Affiche un dossier de séquence dans BinManager
 * 
 * Features:
 * - Expandable folder with slot cards
 * - Progress indicator (ready/total)
 * - Generate all pending button
 * - Drag slots to timeline
 */

import React, { useState } from 'react';
import { SequenceBin, SequenceSlot, getSlotTimecode } from '../types/bins';

interface SequenceBinFolderProps {
  bin: SequenceBin;
  isSelected: boolean;
  onSelect: (binId: string) => void;
  onToggleExpand: (binId: string) => void;
  onSlotClick: (binId: string, slotId: string) => void;
  onSlotGenerate: (binId: string, slotId: string) => void;
  onSlotAddToTimeline: (binId: string, slotId: string) => void;
  onGenerateAll: (binId: string) => void;
  onRename: (binId: string, newName: string) => void;
  onDelete: (binId: string) => void;
}

const SlotStatusIcon: React.FC<{ status: SequenceSlot['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <span className="material-symbols-outlined text-gray-500 text-sm">schedule</span>;
    case 'generating':
      return <span className="material-symbols-outlined text-yellow-500 text-sm animate-spin">progress_activity</span>;
    case 'ready':
      return <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>;
    case 'error':
      return <span className="material-symbols-outlined text-red-500 text-sm">error</span>;
    default:
      return null;
  }
};

export const SequenceBinFolder: React.FC<SequenceBinFolderProps> = ({
  bin,
  isSelected,
  onSelect,
  onToggleExpand,
  onSlotClick,
  onSlotGenerate,
  onSlotAddToTimeline,
  onGenerateAll,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(bin.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const pendingCount = bin.slots.filter(s => s.status === 'pending').length;
  const progressPercent = bin.slots.length > 0 
    ? Math.round((bin.readyCount / bin.slots.length) * 100) 
    : 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== bin.name) {
      onRename(bin.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div className={`rounded-lg overflow-hidden border transition-colors ${
      isSelected ? 'border-indigo-500 bg-indigo-900/10' : 'border-gray-800 bg-gray-900/50'
    }`}>
      {/* Folder Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-800/50"
        onClick={() => onSelect(bin.id)}
        onContextMenu={handleContextMenu}
      >
        {/* Expand Arrow */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(bin.id); }}
          className="text-gray-500 hover:text-white"
        >
          <span className={`material-symbols-outlined text-sm transition-transform ${
            bin.isExpanded ? 'rotate-90' : ''
          }`}>
            chevron_right
          </span>
        </button>

        {/* Folder Icon */}
        <span className={`material-symbols-outlined text-base ${
          bin.readyCount === bin.slots.length ? 'text-green-500' : 'text-indigo-400'
        }`}>
          {bin.isExpanded ? 'folder_open' : 'folder'}
        </span>

        {/* Name */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            className="flex-1 text-xs bg-black/50 border border-indigo-500 rounded px-1 py-0.5 text-white focus:outline-none"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-xs font-medium text-gray-200 truncate">
            {bin.name}
          </span>
        )}

        {/* Progress Badge */}
        <div className={`text-[10px] px-1.5 py-0.5 rounded ${
          bin.readyCount === bin.slots.length 
            ? 'bg-green-900/50 text-green-400' 
            : 'bg-gray-800 text-gray-400'
        }`}>
          {bin.readyCount}/{bin.slots.length}
        </div>
      </div>

      {/* Progress Bar */}
      {bin.slots.length > 0 && (
        <div className="h-0.5 bg-gray-800">
          <div 
            className={`h-full transition-all duration-300 ${
              progressPercent === 100 ? 'bg-green-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Expanded Content */}
      {bin.isExpanded && (
        <div className="p-2 pt-1 space-y-2">
          {/* Generate All Button */}
          {pendingCount > 0 && (
            <button
              onClick={() => onGenerateAll(bin.id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/50 rounded text-indigo-300 text-[10px] font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              Générer {pendingCount} plan{pendingCount > 1 ? 's' : ''} en attente
            </button>
          )}

          {/* Slots List */}
          <div className="space-y-1">
            {bin.slots.map((slot, index) => (
              <div
                key={slot.id}
                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                  slot.status === 'ready' 
                    ? 'bg-gray-800/50 hover:bg-gray-700/50' 
                    : 'bg-gray-900/30 hover:bg-gray-800/30'
                }`}
                onClick={() => onSlotClick(bin.id, slot.id)}
                draggable={slot.status === 'ready'}
                onDragStart={(e) => {
                  if (slot.status === 'ready' && slot.video) {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'sequence-slot',
                      binId: bin.id,
                      slotId: slot.id,
                      video: slot.video,
                      duration: slot.duration,
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                  }
                }}
              >
                {/* Thumbnail or Placeholder */}
                <div className="w-12 h-8 rounded overflow-hidden bg-gray-900 flex-shrink-0 border border-gray-700">
                  {slot.video?.thumbnail ? (
                    <img 
                      src={`data:image/jpeg;base64,${slot.video.thumbnail}`}
                      alt={slot.shotType}
                      className="w-full h-full object-cover"
                    />
                  ) : slot.keyframe ? (
                    <img 
                      src={`data:image/jpeg;base64,${slot.keyframe.base64}`}
                      alt={slot.shotType}
                      className="w-full h-full object-cover opacity-50"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] text-gray-600">{slot.order}</span>
                    </div>
                  )}
                </div>

                {/* Slot Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <SlotStatusIcon status={slot.status} />
                    <span className="text-[10px] font-medium text-gray-300 truncate">
                      {slot.shotType.split(' (')[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-gray-500">
                    <span>@ {getSlotTimecode(bin, index)}</span>
                    <span>{slot.duration}s</span>
                    {slot.cameraMovement && (
                      <span className="text-indigo-400">{slot.cameraMovement.split(' (')[0]}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {slot.status === 'pending' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSlotGenerate(bin.id, slot.id); }}
                      className="p-1 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded"
                      title="Générer ce plan"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                    </button>
                  )}
                  {slot.status === 'ready' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSlotAddToTimeline(bin.id, slot.id); }}
                      className="p-1 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded"
                      title="Ajouter à la timeline"
                    >
                      <span className="material-symbols-outlined text-sm">add_to_queue</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Folder Info */}
          <div className="flex items-center justify-between text-[9px] text-gray-600 pt-1 border-t border-gray-800">
            <span>Total: {bin.totalDuration}s</span>
            {bin.dogmaSnapshot && (
              <span className="text-indigo-400">DA: {bin.dogmaSnapshot.title}</span>
            )}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => { setIsRenaming(true); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-left text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Renommer
          </button>
          {pendingCount > 0 && (
            <button
              onClick={() => { onGenerateAll(bin.id); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-xs text-left text-indigo-300 hover:bg-indigo-900/50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              Générer tout
            </button>
          )}
          <div className="border-t border-gray-700 my-1" />
          <button
            onClick={() => { onDelete(bin.id); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-red-900/50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
};

export default SequenceBinFolder;
