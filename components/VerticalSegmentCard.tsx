/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VerticalSegmentCard - Individual segment in the vertical stack
 * Shows thumbnail, label, lock state, and expands to show iterations
 */
'use client';

import * as React from 'react';
import {
  VerticalSegmentCardProps,
  SegmentRevision
} from '../types/timeline';
import IterationThumbnails from './IterationThumbnails';

/**
 * LockIcon - Simple lock icon component
 */
/**
 * LockIcon - Simple lock icon component
 */
function LockIcon({ locked }: { locked: boolean }) {
  return (
    <span className={`text-sm cursor-pointer transition-opacity ${locked ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}>
      {locked ? '🔒' : '🔓'}
    </span>
  );
}

/**
 * StatusIndicator - Shows generation status
 */
function StatusIndicator({ status }: { status: string }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'succeeded':
        return { icon: '✓', color: 'text-green-400', label: 'Succeeded' };
      case 'running':
        return { icon: '◌', color: 'text-blue-400', label: 'Running' };
      case 'queued':
        return { icon: '◷', color: 'text-yellow-400', label: 'Queued' };
      case 'failed':
        return { icon: '⚠', color: 'text-red-400', label: 'Failed' };
      default:
        return { icon: '—', color: 'text-gray-500', label: 'Unknown' };
    }
  };

  const { icon, color, label } = getStatusInfo();

  return (
    <span className={`text-[12px] ml-2 ${color}`} title={label}>
      {icon}
    </span>
  );
}

import { useDragControls, Reorder } from 'framer-motion';
import { GripVertical, Trash2, Copy } from 'lucide-react'; // Assuming lucide-react is available or use icons from ./icons

/**
 * VerticalSegmentCard
 * 
 * Displays a single segment in the vertical timeline.
 * - Shows thumbnail from active iteration
 * - Displays label and shot type
 * - Lock/unlock toggle
 * - Expands horizontally to show all iterations
 * - Support for Drag (Handle), Delete, Duplicate
 */
export default function VerticalSegmentCard({
  segment,
  isSelected,
  isExpanded,
  onClick,
  onExpand,
  onCollapse,
  onLock,
  onUnlock,
  onIterationClick,
  onIterationValidate,
  onIterationDelete,
  // New actions
  enableDragHandle,
  onDelete,
  onDuplicate
}: VerticalSegmentCardProps & {
  enableDragHandle?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {

  const dragControls = useDragControls();

  // Get active iteration
  const activeIteration = segment.activeRevision;

  // Get previewing iteration (if different from active)
  const previewingIteration = segment.previewingRevisionId
    ? segment.revisions?.find((iter) => iter.id === segment.previewingRevisionId)
    : null;

  // Displayed iteration (preview takes precedence)
  const displayedIteration = previewingIteration || activeIteration;

  const isLocked = segment.uiState === 'locked';

  const handleCardClick = () => {
    if (isLocked) return;
    onClick();
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    isExpanded ? onCollapse() : onExpand();
  };

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    isLocked ? onUnlock() : onLock();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    if (confirm('Delete this segment?')) {
      onDelete?.();
    }
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.();
  };

  return (
    <Reorder.Item
      value={segment}
      id={segment.id}
      dragListener={false}
      dragControls={dragControls}
      className="relative" // Valid wrapper for card
    >
      <div
        className={`bg-[#2a2a2a] rounded-lg border-2 transition-all overflow-hidden ${isSelected ? 'border-indigo-500 bg-indigo-900/20' : 'border-transparent hover:border-indigo-500/50 hover:bg-[#333]'} ${isLocked ? 'opacity-80' : ''}`}
        onClick={handleCardClick}
      >
        {/* Main card content */}
        <div className={`flex items-center p-2 gap-2 ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>

          {/* Drag Handle */}
          {enableDragHandle && !isLocked && (
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-300 p-1"
            >
              <GripVertical size={16} />
            </div>
          )}

          {/* Thumbnail */}
          <div className="w-20 h-11 rounded bg-black shrink-0 overflow-hidden">
            {displayedIteration?.outputAsset?.url ? (
              <img
                src={displayedIteration.outputAsset.url}
                alt={segment.label || `Segment ${segment.order + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-xl">
                <span>🎬</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {segment.label || `Plan ${segment.order + 1}`}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
              <span className="truncate">{displayedIteration?.provider || '—'}</span>
              <span>{formatDuration(segment.durationSec)}</span>
              {displayedIteration && (
                <StatusIndicator status={displayedIteration.status} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!isLocked && (
              <>
                <button
                  className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded text-xs transition-colors"
                  onClick={handleDuplicate}
                  title="Dupliquer"
                >
                  <Copy size={14} />
                </button>
                <button
                  className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded text-xs transition-colors"
                  onClick={handleDelete}
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}

            <button
              className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded text-xs transition-colors"
              onClick={handleLockToggle}
              title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
            >
              <LockIcon locked={isLocked} />
            </button>

            {!isLocked && (
              <button
                className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded text-xs transition-colors"
                onClick={handleExpandToggle}
                title={isExpanded ? 'Réduire' : 'Voir les itérations'}
              >
                {isExpanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded iterations */}
        {isExpanded && !isLocked && (
          <div className="p-2 pt-0 border-t border-[#333]">
            <IterationThumbnails
              iterations={segment.revisions || []}
              activeRevisionId={segment.activeRevisionId || ''}
              previewingRevisionId={segment.previewingRevisionId}
              onIterationClick={onIterationClick}
              onIterationDelete={onIterationDelete}
            />
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
