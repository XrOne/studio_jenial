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
    VerticalTimelineSegment,
    SegmentIteration
} from '../types-vertical-timeline';

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
    activeIteration,
    activeTab,
    onTabChange,
    onReprompt,
    onRegenerate,
}: SegmentIAPanelProps) {

    const [promptValue, setPromptValue] = React.useState('');

    // Update prompt value when segment changes
    React.useEffect(() => {
        if (activeIteration) {
            setPromptValue(activeIteration.prompt);
        }
    }, [activeIteration?.id]);

    const handleReprompt = () => {
        if (promptValue.trim() && promptValue !== activeIteration?.prompt) {
            onReprompt(promptValue);
        }
    };

    if (!segment) {
        return (
            <div className="ia-panel empty">
                <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <p>Sélectionnez un segment pour voir ses détails</p>
                </div>
                <style jsx>{`
          .ia-panel.empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: var(--surface-secondary, #1e1e1e);
          }
          .empty-state {
            text-align: center;
            color: var(--text-secondary, #888);
          }
          .empty-icon {
            font-size: 32px;
            display: block;
            margin-bottom: 12px;
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="ia-panel">
            {/* Header */}
            <div className="ia-panel-header">
                <h3>IA Panel</h3>
                <span className="segment-name">{segment.label || `Plan ${segment.position + 1}`}</span>
            </div>

            {/* Tab navigation */}
            <div className="ia-panel-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="ia-panel-content">

                {/* Prompt Tab */}
                {activeTab === 'prompt' && (
                    <div className="tab-content prompt-tab">
                        <label className="field-label">Root Prompt</label>
                        <textarea
                            className="prompt-input"
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            placeholder="Décrivez le plan..."
                            rows={4}
                        />

                        {segment.dogma && (
                            <>
                                <label className="field-label">Dogma</label>
                                <div className="dogma-badge">
                                    {segment.dogma.title}
                                </div>
                            </>
                        )}

                        <div className="prompt-actions">
                            <button
                                className="btn-secondary"
                                onClick={onRegenerate}
                                disabled={!activeIteration}
                            >
                                Régénérer
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleReprompt}
                                disabled={promptValue === activeIteration?.prompt}
                            >
                                Créer variation
                            </button>
                        </div>
                    </div>
                )}

                {/* Keyframes Tab */}
                {activeTab === 'keyframes' && (
                    <div className="tab-content keyframes-tab">
                        <p className="placeholder-text">
                            Keyframes extraites de la version active
                        </p>
                        {/* TODO: Display keyframes from activeIteration */}
                    </div>
                )}

                {/* Edit Image Tab */}
                {activeTab === 'edit-image' && (
                    <div className="tab-content edit-image-tab">
                        <p className="placeholder-text">
                            Retouche d'image avec Nano
                        </p>
                        {/* TODO: Nano editor integration */}
                    </div>
                )}

                {/* Edit Video Tab */}
                {activeTab === 'edit-video' && (
                    <div className="tab-content edit-video-tab">
                        <p className="placeholder-text">
                            Paramètres de la vidéo (durée, vitesse...)
                        </p>
                        {/* TODO: Video editing controls */}
                    </div>
                )}

                {/* Versions Tab */}
                {activeTab === 'versions' && (
                    <div className="tab-content versions-tab">
                        <p className="versions-count">
                            {segment.iterations.length} version(s)
                        </p>
                        <div className="versions-list">
                            {segment.iterations.map((iter, index) => (
                                <div
                                    key={iter.id}
                                    className={`version-item ${iter.id === segment.activeIterationId ? 'active' : ''}`}
                                >
                                    <span className="version-number">v{index + 1}</span>
                                    <span className="version-model">{iter.model}</span>
                                    <span className="version-status">{iter.status}</span>
                                    <span className="version-date">
                                        {new Date(iter.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Styles */}
            <style jsx>{`
        .ia-panel {
          display: flex;
          flex-direction: column;
          width: 320px;
          height: 100%;
          background: var(--surface-secondary, #1e1e1e);
          border-left: 1px solid var(--border-color, #333);
        }
        
        .ia-panel-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #333);
        }
        
        .ia-panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        .segment-name {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }
        
        .ia-panel-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 8px;
          border-bottom: 1px solid var(--border-color, #333);
        }
        
        .tab-btn {
          padding: 6px 10px;
          font-size: 11px;
          background: transparent;
          border: 1px solid var(--border-color, #333);
          border-radius: 4px;
          color: var(--text-secondary, #888);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .tab-btn:hover {
          border-color: var(--accent-color, #60a5fa);
          color: var(--text-primary, #fff);
        }
        
        .tab-btn.active {
          background: var(--accent-color, #60a5fa);
          border-color: var(--accent-color, #60a5fa);
          color: #fff;
        }
        
        .ia-panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        
        .tab-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .field-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary, #888);
        }
        
        .prompt-input {
          width: 100%;
          padding: 10px;
          font-size: 13px;
          background: var(--surface-tertiary, #2a2a2a);
          border: 1px solid var(--border-color, #333);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          resize: vertical;
          min-height: 80px;
        }
        
        .prompt-input:focus {
          outline: none;
          border-color: var(--accent-color, #60a5fa);
        }
        
        .dogma-badge {
          display: inline-block;
          padding: 4px 8px;
          background: var(--accent-color-dim, #1e3a5f);
          border-radius: 4px;
          font-size: 12px;
          color: var(--accent-color, #60a5fa);
        }
        
        .prompt-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        
        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 8px 12px;
          font-size: 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .btn-primary {
          background: var(--accent-color, #60a5fa);
          border: none;
          color: #fff;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: var(--accent-color-hover, #3b82f6);
        }
        
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--border-color, #333);
          color: var(--text-primary, #fff);
        }
        
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--accent-color, #60a5fa);
        }
        
        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .placeholder-text {
          color: var(--text-secondary, #888);
          font-size: 13px;
          text-align: center;
          padding: 24px;
        }
        
        .versions-count {
          font-size: 12px;
          color: var(--text-secondary, #888);
          margin-bottom: 8px;
        }
        
        .versions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .version-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--surface-tertiary, #2a2a2a);
          border-radius: 6px;
          font-size: 12px;
        }
        
        .version-item.active {
          border: 1px solid var(--accent-success, #4ade80);
        }
        
        .version-number {
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        .version-model {
          color: var(--accent-color, #60a5fa);
        }
        
        .version-status {
          color: var(--text-secondary, #888);
        }
        
        .version-date {
          margin-left: auto;
          color: var(--text-muted, #666);
        }
      `}</style>
        </div>
    );
}
