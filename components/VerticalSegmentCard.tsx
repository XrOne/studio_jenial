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
    SegmentIteration
} from '../types-vertical-timeline';
import IterationThumbnails from './IterationThumbnails';

/**
 * LockIcon - Simple lock icon component
 */
function LockIcon({ locked }: { locked: boolean }) {
    return (
        <span className={`lock-icon ${locked ? 'locked' : 'unlocked'}`}>
            {locked ? '🔒' : '🔓'}
            <style jsx>{`
        .lock-icon {
          font-size: 14px;
          cursor: pointer;
        }
        .lock-icon.locked {
          opacity: 1;
        }
        .lock-icon.unlocked {
          opacity: 0.5;
        }
        .lock-icon:hover {
          opacity: 1;
        }
      `}</style>
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
                return { icon: '✓', color: '#4ade80', label: 'Succeeded' };
            case 'running':
                return { icon: '◌', color: '#60a5fa', label: 'Running' };
            case 'queued':
                return { icon: '◷', color: '#facc15', label: 'Queued' };
            case 'failed':
                return { icon: '⚠', color: '#f87171', label: 'Failed' };
            default:
                return { icon: '—', color: '#888', label: 'Unknown' };
        }
    };

    const { icon, color, label } = getStatusInfo();

    return (
        <span className="status-indicator" title={label} style={{ color }}>
            {icon}
            <style jsx>{`
        .status-indicator {
          font-size: 12px;
          margin-left: 8px;
        }
      `}</style>
        </span>
    );
}

/**
 * VerticalSegmentCard
 * 
 * Displays a single segment in the vertical timeline.
 * - Shows thumbnail from active iteration
 * - Displays label and shot type
 * - Lock/unlock toggle
 * - Expands horizontally to show all iterations
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
}: VerticalSegmentCardProps) {

    // Get active iteration
    const activeIteration = segment.iterations.find(
        (iter) => iter.id === segment.activeIterationId
    );

    // Get previewing iteration (if different from active)
    const previewingIteration = segment.previewingIterationId
        ? segment.iterations.find((iter) => iter.id === segment.previewingIterationId)
        : null;

    // Displayed iteration (preview takes precedence)
    const displayedIteration = previewingIteration || activeIteration;

    const isLocked = segment.state === 'locked';

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

    return (
        <div
            className={`segment-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''} ${isLocked ? 'locked' : ''}`}
            onClick={handleCardClick}
        >
            {/* Main card content */}
            <div className="segment-main">
                {/* Thumbnail */}
                <div className="segment-thumbnail">
                    {displayedIteration?.keyframeThumbnail ? (
                        <img
                            src={displayedIteration.keyframeThumbnail}
                            alt={segment.label || `Segment ${segment.position + 1}`}
                        />
                    ) : (
                        <div className="thumbnail-placeholder">
                            <span>🎬</span>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="segment-info">
                    <div className="segment-label">
                        {segment.label || `Plan ${segment.position + 1}`}
                    </div>
                    <div className="segment-meta">
                        <span>{displayedIteration?.model || '—'}</span>
                        <span>{formatDuration(segment.duration)}</span>
                        {displayedIteration && (
                            <StatusIndicator status={displayedIteration.status} />
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="segment-actions">
                    <button
                        className="lock-btn"
                        onClick={handleLockToggle}
                        title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
                    >
                        <LockIcon locked={isLocked} />
                    </button>

                    {!isLocked && (
                        <button
                            className="expand-btn"
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
                <div className="segment-iterations">
                    <IterationThumbnails
                        iterations={segment.iterations}
                        activeIterationId={segment.activeIterationId}
                        previewingIterationId={segment.previewingIterationId}
                        onIterationClick={onIterationClick}
                        onIterationDelete={onIterationDelete}
                    />
                </div>
            )}

            {/* Styles */}
            <style jsx>{`
        .segment-card {
          background: var(--surface-tertiary, #2a2a2a);
          border-radius: 8px;
          border: 2px solid transparent;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .segment-card:hover:not(.locked) {
          border-color: var(--accent-color, #60a5fa);
        }
        
        .segment-card.selected {
          border-color: var(--accent-color, #60a5fa);
          background: var(--surface-selected, #1e3a5f);
        }
        
        .segment-card.locked {
          opacity: 0.8;
        }
        
        .segment-main {
          display: flex;
          align-items: center;
          padding: 8px;
          gap: 12px;
          cursor: pointer;
        }
        
        .segment-card.locked .segment-main {
          cursor: default;
        }
        
        .segment-thumbnail {
          width: 80px;
          height: 45px;
          border-radius: 4px;
          overflow: hidden;
          background: #000;
          flex-shrink: 0;
        }
        
        .segment-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-secondary, #1e1e1e);
          font-size: 20px;
        }
        
        .segment-info {
          flex: 1;
          min-width: 0;
        }
        
        .segment-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .segment-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-secondary, #888);
          margin-top: 4px;
        }
        
        .segment-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .lock-btn,
        .expand-btn {
          background: none;
          border: none;
          color: var(--text-secondary, #888);
          cursor: pointer;
          padding: 4px;
          font-size: 12px;
          border-radius: 4px;
        }
        
        .lock-btn:hover,
        .expand-btn:hover {
          background: var(--surface-hover, #333);
          color: var(--text-primary, #fff);
        }
        
        .segment-iterations {
          padding: 8px;
          padding-top: 0;
          border-top: 1px solid var(--border-color, #333);
        }
      `}</style>
        </div>
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
