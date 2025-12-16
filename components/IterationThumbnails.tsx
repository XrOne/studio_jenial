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
    SegmentIteration
} from '../types-vertical-timeline';

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
    activeIterationId,
    previewingIterationId,
    onIterationClick,
    onIterationDelete,
}: IterationThumbnailsProps) {

    // Sort: active first, then by creation date (oldest to newest)
    const sortedIterations = React.useMemo(() => {
        const active = iterations.find((i) => i.id === activeIterationId);
        const others = iterations
            .filter((i) => i.id !== activeIterationId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        return active ? [active, ...others] : others;
    }, [iterations, activeIterationId]);

    return (
        <div className="iteration-thumbnails">
            {sortedIterations.map((iteration, index) => {
                const isActive = iteration.id === activeIterationId;
                const isPreviewing = iteration.id === previewingIterationId;

                return (
                    <div
                        key={iteration.id}
                        className={`iteration-thumb ${isActive ? 'active' : ''} ${isPreviewing ? 'previewing' : ''}`}
                        onClick={() => onIterationClick(iteration.id)}
                        title={`${iteration.prompt.substring(0, 50)}...`}
                    >
                        {/* Thumbnail image */}
                        {iteration.keyframeThumbnail ? (
                            <img
                                src={iteration.keyframeThumbnail}
                                alt={`Iteration ${index + 1}`}
                            />
                        ) : (
                            <div className="thumb-placeholder">
                                {iteration.status === 'running' ? '◌' : '🎬'}
                            </div>
                        )}

                        {/* Active badge */}
                        {isActive && (
                            <span className="active-badge">●</span>
                        )}

                        {/* Status overlay for non-succeeded */}
                        {iteration.status !== 'succeeded' && (
                            <div className="status-overlay">
                                {iteration.status === 'running' && <span className="spinner">◌</span>}
                                {iteration.status === 'queued' && <span>◷</span>}
                                {iteration.status === 'failed' && <span>⚠</span>}
                            </div>
                        )}

                        {/* Delete button (hover) */}
                        {!isActive && (
                            <button
                                className="delete-btn"
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

            {/* Styles */}
            <style jsx>{`
        .iteration-thumbnails {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 8px 0;
        }
        
        .iteration-thumb {
          position: relative;
          width: 60px;
          height: 34px;
          border-radius: 4px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          flex-shrink: 0;
          background: #000;
          transition: all 0.15s ease;
        }
        
        .iteration-thumb:hover {
          border-color: var(--accent-color, #60a5fa);
          transform: scale(1.05);
        }
        
        .iteration-thumb.active {
          border-color: var(--accent-success, #4ade80);
        }
        
        .iteration-thumb.previewing {
          border-color: var(--accent-warning, #facc15);
        }
        
        .iteration-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .thumb-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-secondary, #1e1e1e);
          font-size: 14px;
          color: var(--text-secondary, #888);
        }
        
        .active-badge {
          position: absolute;
          top: 2px;
          left: 2px;
          font-size: 8px;
          color: var(--accent-success, #4ade80);
        }
        
        .status-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          font-size: 16px;
        }
        
        .spinner {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .delete-btn {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.9);
          color: #fff;
          border: none;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        
        .iteration-thumb:hover .delete-btn {
          opacity: 1;
        }
        
        .delete-btn:hover {
          background: #ef4444;
        }
      `}</style>
        </div>
    );
}
