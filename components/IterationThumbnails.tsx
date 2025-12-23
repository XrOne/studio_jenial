/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IterationThumbnails - Horizontal strip of iteration thumbnails
 * Shown when a segment is expanded
 */
'use client';

import * as React from 'react';
import {
  IterationThumbnailsProps,
  SegmentRevision
} from '../types/timeline';

/**
 * IterationThumbnails
 * 
 * Displays all iterations of a segment as a horizontal strip.
 * - Active iteration is shown first (leftmost)
 * - More recent iterations are to the right
 * - Click to preview, delete button on hover
 */
export default function IterationThumbnails({
  iterations,
  activeRevisionId,
  previewingRevisionId,
  onIterationClick,
  onIterationDelete,
}: IterationThumbnailsProps) {

  // Sort: active first, then by creation date (oldest to newest)
  const sortedIterations = React.useMemo(() => {
    const active = iterations.find((i) => i.id === activeRevisionId);
    const others = iterations
      .filter((i) => i.id !== activeRevisionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return active ? [active, ...others] : others;
  }, [iterations, activeRevisionId]);

  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {sortedIterations.map((iteration, index) => {
        const isActive = iteration.id === activeRevisionId;
        const isPreviewing = iteration.id === previewingRevisionId;

        return (
          <div
            key={iteration.id}
            className={`group relative w-[60px] h-[34px] rounded border-2 shrink-0 cursor-pointer overflow-hidden transition-all hover:scale-105 ${isActive ? 'border-green-400' : isPreviewing ? 'border-yellow-400' : 'border-transparent hover:border-blue-400'}`}
            onClick={() => onIterationClick(iteration.id)}
            title={`${iteration.promptJson.rootPrompt.substring(0, 50)}...`}
          >
            {/* Thumbnail image */}
            {iteration.outputAsset?.url ? (
              <img
                src={iteration.outputAsset.url}
                alt={`Iteration ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] text-[10px] text-gray-500">
                {iteration.status === 'running' ? '◌' : '🎬'}
              </div>
            )}

            {/* Active badge */}
            {isActive && (
              <span className="absolute top-0.5 left-0.5 text-[8px] text-green-400">●</span>
            )}

            {/* Status overlay for non-succeeded */}
            {iteration.status !== 'succeeded' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-[10px]">
                {iteration.status === 'running' && <span className="animate-spin">◌</span>}
                {iteration.status === 'queued' && <span>◷</span>}
                {iteration.status === 'failed' && <span>⚠</span>}
              </div>
            )}

            {/* Delete button (hover) */}
            {!isActive && (
              <button
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600/90 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onIterationDelete(iteration.id);
                }}
                title="Supprimer cette itération"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
