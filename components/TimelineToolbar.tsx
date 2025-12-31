/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TimelineToolbar - NLE-style toolbar with editing actions
 * Provides cut, undo/redo, zoom controls
 */
'use client';

import * as React from 'react';
import { TrimMode } from './TimelineClip';

interface TimelineToolbarProps {
    onUndo?: () => void;
    onRedo?: () => void;
    onCut?: () => void;
    onRippleDelete?: () => void;
    onInsert?: () => void;
    onOverwrite?: () => void;
    onExport?: () => void;
    onSaveJson?: () => void;
    onLoadJson?: () => void;
    pixelsPerSecond: number;
    onZoomChange: (pps: number) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    hasSelection?: boolean;
    // Premiere Pro-style toggles
    linkedSelection?: boolean;
    onLinkedSelectionToggle?: () => void;
    snapping?: boolean;
    onSnappingToggle?: () => void;
    // Trim mode
    trimMode?: TrimMode;
    onTrimModeChange?: (mode: TrimMode) => void;
    // 3-Point Edit
    timelineIn?: number | null;
    timelineOut?: number | null;
    onSetTimelineIn?: () => void;
    onSetTimelineOut?: () => void;
    onClearTimelineMarks?: () => void;
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
    // Premiere Pro-style toggle state from props
    const linkedSelection = arguments[0].linkedSelection !== undefined ? arguments[0].linkedSelection : true;
    const snapping = arguments[0].snapping !== undefined ? arguments[0].snapping : true;
    const onLinkedSelectionToggle = arguments[0].onLinkedSelectionToggle;
    const onSnappingToggle = arguments[0].onSnappingToggle;
    const trimMode = arguments[0].trimMode || 'normal';
    const onTrimModeChange = arguments[0].onTrimModeChange;
    const timelineIn = arguments[0].timelineIn;
    const timelineOut = arguments[0].timelineOut;
    const onSetTimelineIn = arguments[0].onSetTimelineIn;
    const onSetTimelineOut = arguments[0].onSetTimelineOut;
    const onClearTimelineMarks = arguments[0].onClearTimelineMarks;

    const trimModes: { value: TrimMode; label: string; icon: string }[] = [
        { value: 'normal', label: 'Normal', icon: 'select_all' },
        { value: 'ripple', label: 'Ripple', icon: 'format_line_spacing' },
        { value: 'roll', label: 'Roll', icon: 'sync_alt' },
        { value: 'slip', label: 'Slip', icon: 'swap_horiz' },
        { value: 'slide', label: 'Slide', icon: 'open_with' },
    ];

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

                {/* Premiere Pro-style toggles */}
                <button
                    onClick={onLinkedSelectionToggle}
                    className={`
                        p-1.5 rounded transition-colors
                        ${linkedSelection
                            ? 'text-yellow-400 bg-yellow-400/10'
                            : 'text-gray-600 hover:text-gray-400'
                        }
                    `}
                    title={`Linked Selection: ${linkedSelection ? 'ON' : 'OFF'}`}
                >
                    <span className="material-symbols-outlined text-lg">link</span>
                </button>
                <button
                    onClick={onSnappingToggle}
                    className={`
                        p-1.5 rounded transition-colors
                        ${snapping
                            ? 'text-blue-400 bg-blue-400/10'
                            : 'text-gray-600 hover:text-gray-400'
                        }
                    `}
                    title={`Snapping: ${snapping ? 'ON' : 'OFF'}`}
                >
                    <span className="material-symbols-outlined text-lg">align_horizontal_left</span>
                </button>

                <div className="w-px h-5 bg-[#333] mx-2" />

                {/* Trim Mode Selector */}
                <div className="relative">
                    <select
                        value={trimMode}
                        onChange={(e) => onTrimModeChange?.(e.target.value as TrimMode)}
                        className="bg-[#2a2a2a] text-gray-300 text-xs px-2 py-1 rounded border border-[#444] 
                                   hover:border-[#666] focus:border-primary focus:outline-none cursor-pointer"
                        title="Trim Mode"
                    >
                        {trimModes.map(mode => (
                            <option key={mode.value} value={mode.value}>
                                {mode.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="w-px h-5 bg-[#333] mx-2" />

                {/* 3-Point Edit Markers */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onSetTimelineIn}
                        className={`
                            p-1 rounded transition-colors text-xs font-mono
                            ${timelineIn !== null && timelineIn !== undefined
                                ? 'text-green-400 bg-green-400/10'
                                : 'text-gray-500 hover:text-gray-300'
                            }
                        `}
                        title={`Set In Point (I)${timelineIn != null ? ` - ${timelineIn.toFixed(2)}s` : ''}`}
                    >
                        <span className="material-symbols-outlined text-sm">start</span>
                    </button>
                    <button
                        onClick={onSetTimelineOut}
                        className={`
                            p-1 rounded transition-colors text-xs font-mono
                            ${timelineOut !== null && timelineOut !== undefined
                                ? 'text-red-400 bg-red-400/10'
                                : 'text-gray-500 hover:text-gray-300'
                            }
                        `}
                        title={`Set Out Point (O)${timelineOut != null ? ` - ${timelineOut.toFixed(2)}s` : ''}`}
                    >
                        <span className="material-symbols-outlined text-sm">keyboard_tab</span>
                    </button>
                    {(timelineIn != null || timelineOut != null) && (
                        <button
                            onClick={onClearTimelineMarks}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                            title="Clear In/Out Marks"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    )}
                </div>

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
