/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelineToolbar - NLE-style toolbar with editing actions
 * Provides cut, undo/redo, zoom controls
 */
'use client';

import * as React from 'react';

interface TimelineToolbarProps {
    onUndo?: () => void;
    onRedo?: () => void;
    onCut?: () => void;
    onRippleDelete?: () => void;
    onInsert?: () => void;
    onOverwrite?: () => void;
    onExport?: () => void;
    onSaveJson?: () => void; // New
    onLoadJson?: () => void; // New
    pixelsPerSecond: number;
    onZoomChange: (pps: number) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    hasSelection?: boolean;
}

interface ToolButton {
    icon: string;
    label: string;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    primary?: boolean;
}

/**
 * TimelineToolbar
 * 
 * Toolbar above the timeline with NLE editing controls.
 */
export default function TimelineToolbar({
    onUndo,
    onRedo,
    onCut,
    onRippleDelete,
    onInsert,
    onOverwrite,
    onExport,
    onSaveJson,
    onLoadJson,
    pixelsPerSecond,
    onZoomChange,
    canUndo = false,
    canRedo = false,
    hasSelection = false,
}: TimelineToolbarProps) {

    const zoomLevels = [20, 40, 60, 80, 100, 150, 200];
    const currentZoomIndex = zoomLevels.findIndex(z => z >= pixelsPerSecond);

    const handleZoomIn = () => {
        const nextIndex = Math.min(currentZoomIndex + 1, zoomLevels.length - 1);
        onZoomChange(zoomLevels[nextIndex]);
    };

    const handleZoomOut = () => {
        const prevIndex = Math.max(currentZoomIndex - 1, 0);
        onZoomChange(zoomLevels[prevIndex]);
    };

    const leftTools: ToolButton[] = [
        { icon: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo, disabled: !canUndo },
        { icon: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', action: onRedo, disabled: !canRedo },
    ];

    const editTools: ToolButton[] = [
        { icon: 'content_cut', label: 'Cut', shortcut: 'X', action: onCut, disabled: !hasSelection },
        { icon: 'backspace', label: 'Ripple Delete', shortcut: 'Backspace', action: onRippleDelete, disabled: !hasSelection },
        { icon: 'view_week', label: 'Insert', shortcut: 'V', action: onInsert, disabled: !hasSelection },
        { icon: 'input', label: 'Overwrite', shortcut: 'B', action: onOverwrite, disabled: !hasSelection },
    ];

    return (
        <div className="h-9 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-3 select-none">
            {/* Left tools */}
            <div className="flex items-center gap-1">
                {leftTools.map((tool) => (
                    <button
                        key={tool.icon}
                        className={`
              p-1.5 rounded transition-colors
              ${tool.disabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
            `}
                        onClick={tool.action}
                        disabled={tool.disabled}
                        title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                    >
                        <span className="material-symbols-outlined text-lg">{tool.icon}</span>
                    </button>
                ))}

                <div className="w-px h-5 bg-[#333] mx-2" />

                {editTools.map((tool) => (
                    <button
                        key={tool.icon}
                        className={`
              p-1.5 rounded transition-colors
              ${tool.disabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }
            `}
                        onClick={tool.action}
                        disabled={tool.disabled}
                        title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                    >
                        <span className="material-symbols-outlined text-lg">{tool.icon}</span>
                    </button>
                ))}

                <div className="w-px h-5 bg-[#333] mx-2" />

                {/* JSON Backup Buttons */}
                <button
                    onClick={onLoadJson}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    title="Load Project Backup (JSON)"
                >
                    <span className="material-symbols-outlined text-lg">upload_file</span>
                </button>
                <button
                    onClick={onSaveJson}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    title="Save Project Backup (JSON)"
                >
                    <span className="material-symbols-outlined text-lg">save</span>
                </button>

            </div>

            {/* Right tools - Zoom & Export */}
            <div className="flex items-center gap-4">
                {/* Export Button */}
                <button
                    onClick={onExport}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Export
                </button>

                <div className="w-px h-5 bg-[#333]" />

                <div className="flex items-center gap-2">
                    <button
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        onClick={handleZoomOut}
                        disabled={currentZoomIndex <= 0}
                        title="Zoom Out (-)"
                    >
                        <span className="material-symbols-outlined text-lg">remove</span>
                    </button>

                    <div className="w-24 h-1.5 bg-[#333] rounded-full relative">
                        <div
                            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all"
                            style={{ width: `${((currentZoomIndex) / (zoomLevels.length - 1)) * 100}%` }}
                        />
                        <input
                            type="range"
                            min="0"
                            max={zoomLevels.length - 1}
                            value={currentZoomIndex}
                            onChange={(e) => onZoomChange(zoomLevels[parseInt(e.target.value)])}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                    </div>

                    <button
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        onClick={handleZoomIn}
                        disabled={currentZoomIndex >= zoomLevels.length - 1}
                        title="Zoom In (+)"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                    </button>

                    <span className="text-[10px] text-gray-500 font-mono w-10 text-right">
                        {Math.round((pixelsPerSecond / 100) * 100)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
