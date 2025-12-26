/**
 * BinManager Component
 * Full-featured media library with drag-drop upload, grid view, and timeline integration
 */

import React, { useState, useRef, useCallback } from 'react';
import { useLocalMediaLibrary } from '../hooks/useLocalMediaLibrary';
import { RushMedia } from '../types/media';

interface BinManagerProps {
    onMediaSelect?: (media: RushMedia) => void;
    onAddToTimeline?: (media: RushMedia) => void;
}

export const BinManager: React.FC<BinManagerProps> = ({ onMediaSelect, onAddToTimeline }) => {
    const { rushes, generated, isLoading, uploadMedia, deleteMedia, renameMedia } = useLocalMediaLibrary();
    const [activeTab, setActiveTab] = useState<'rushes' | 'generated'>('rushes');
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [filter, setFilter] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; media: RushMedia } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentMedia = activeTab === 'rushes' ? rushes : generated;
    const filteredMedia = filter
        ? currentMedia.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
        : currentMedia;

    // Handle file drop
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files).filter(
            f => f.type.startsWith('video/') || f.type.startsWith('image/')
        );

        if (files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < files.length; i++) {
            await uploadMedia(files[i], activeTab);
            setUploadProgress(((i + 1) / files.length) * 100);
        }

        setIsUploading(false);
        setUploadProgress(0);
    }, [uploadMedia, activeTab]);

    // Handle file input
    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < files.length; i++) {
            await uploadMedia(files[i], activeTab);
            setUploadProgress(((i + 1) / files.length) * 100);
        }

        setIsUploading(false);
        setUploadProgress(0);

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [uploadMedia, activeTab]);

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, media: RushMedia) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, media });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleRename = (media: RushMedia) => {
        setRenamingId(media.id);
        setRenameValue(media.name);
        closeContextMenu();
    };

    const submitRename = (media: RushMedia) => {
        if (renameValue.trim()) {
            renameMedia(media.id, renameValue.trim(), activeTab);
        }
        setRenamingId(null);
        setRenameValue('');
    };

    const handleDelete = (media: RushMedia) => {
        if (confirm(`Supprimer "${media.name}" ?`)) {
            deleteMedia(media.id, activeTab);
        }
        closeContextMenu();
    };

    const handleAddToTimeline = (media: RushMedia) => {
        if (onAddToTimeline) {
            onAddToTimeline(media);
        }
        closeContextMenu();
    };

    // Format duration
    const formatDuration = (sec?: number) => {
        if (!sec) return '';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <aside className="w-72 flex flex-col bg-[#161616] border-r border-[#3f3f46] shrink-0 z-20">
            {/* Header */}
            <div className="h-14 border-b border-[#3f3f46] flex items-center px-4 justify-between bg-[#1e1e1e]">
                <h2 className="font-semibold text-sm text-gray-200">Bin Manager</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Importer des fichiers"
                    >
                        <span className="material-symbols-outlined text-lg">cloud_upload</span>
                    </button>
                </div>
            </div>

            {/* Tabs & Filter */}
            <div className="p-3 border-b border-[#3f3f46] bg-[#1a1a1a]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex bg-black/40 rounded p-0.5 border border-[#3f3f46]">
                        <button
                            onClick={() => setActiveTab('rushes')}
                            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${activeTab === 'rushes'
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                                }`}
                        >
                            Rushes ({rushes.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('generated')}
                            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${activeTab === 'generated'
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                                }`}
                        >
                            Générés ({generated.length})
                        </button>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-400 border border-gray-700 px-2 py-1 rounded hover:border-indigo-400 transition-colors"
                    >
                        <span>Import</span>
                        <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                </div>
                <div className="relative">
                    <span className="absolute left-2 top-1.5 text-gray-500 material-symbols-outlined text-sm">search</span>
                    <input
                        className="w-full pl-8 pr-2 py-1.5 text-xs bg-black/40 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Filter media..."
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Media Grid */}
            <div
                className={`flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start bg-[#121212] ${isDragging ? 'ring-2 ring-indigo-500 ring-inset' : ''
                    }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={closeContextMenu}
            >
                {/* Upload Zone */}
                <div
                    className={`col-span-2 border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center transition-colors cursor-pointer mb-2 ${isDragging
                        ? 'border-indigo-500 bg-indigo-900/20 text-indigo-300'
                        : 'border-gray-800 text-gray-600 hover:border-gray-500 bg-gray-900/20'
                        }`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {isUploading ? (
                        <>
                            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <span className="text-[10px]">Upload {Math.round(uploadProgress)}%</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-2xl mb-1">
                                {isDragging ? 'file_download' : 'add_circle_outline'}
                            </span>
                            <span className="text-[10px]">
                                {isDragging ? 'Déposez ici' : 'Glisser ou cliquer pour upload'}
                            </span>
                        </>
                    )}
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="col-span-2 text-center py-8">
                        <span className="material-symbols-outlined text-3xl text-gray-600 animate-spin">refresh</span>
                        <p className="text-xs text-gray-600 mt-2">Chargement...</p>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && filteredMedia.length === 0 && (
                    <div className="col-span-2 text-center py-8">
                        <span className="material-symbols-outlined text-3xl text-gray-700">folder_open</span>
                        <p className="text-xs text-gray-600 mt-2">
                            {filter ? 'Aucun résultat' : 'Aucun média'}
                        </p>
                    </div>
                )}

                {/* Media Items */}
                {filteredMedia.map(media => (
                    <div
                        key={media.id}
                        className="group relative aspect-video bg-gray-800 rounded overflow-hidden border border-transparent hover:border-indigo-500 cursor-pointer ring-1 ring-white/5"
                        onClick={() => onMediaSelect?.(media)}
                        onContextMenu={(e) => handleContextMenu(e, media)}
                        onDoubleClick={() => handleAddToTimeline(media)}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(media));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                    >
                        {/* Thumbnail */}
                        {media.thumbnail ? (
                            <img
                                src={media.thumbnail}
                                alt={media.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
                                <span className="material-symbols-outlined text-gray-700 text-3xl">
                                    {media.type === 'video' ? 'movie' : 'image'}
                                </span>
                            </div>
                        )}

                        {/* Duration Badge (for videos) */}
                        {media.type === 'video' && media.durationSec && (
                            <div className="absolute top-1 right-1 text-[9px] bg-black/80 text-white px-1 py-0.5 rounded font-mono">
                                {formatDuration(media.durationSec)}
                            </div>
                        )}

                        {/* Type Badge */}
                        <div className="absolute top-1 left-1">
                            <span className={`material-symbols-outlined text-sm ${media.type === 'video' ? 'text-blue-400' : 'text-green-400'
                                }`}>
                                {media.type === 'video' ? 'videocam' : 'image'}
                            </span>
                        </div>

                        {/* Name Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4">
                            {renamingId === media.id ? (
                                <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={() => submitRename(media)}
                                    onKeyDown={(e) => e.key === 'Enter' && submitRename(media)}
                                    className="w-full text-[10px] bg-black/50 border border-indigo-500 rounded px-1 py-0.5 text-white focus:outline-none"
                                    autoFocus
                                />
                            ) : (
                                <p className="text-[10px] text-white truncate font-medium">{media.name}</p>
                            )}
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(media); }}
                                className="p-1.5 bg-red-600/80 rounded-full hover:bg-red-500 transition-colors"
                                title="Supprimer"
                            >
                                <span className="material-symbols-outlined text-white text-sm">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="video/*,image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={closeContextMenu}
                >
                    <button
                        onClick={() => handleAddToTimeline(contextMenu.media)}
                        className="w-full px-3 py-2 text-sm text-left text-gray-200 hover:bg-indigo-600 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">add_to_queue</span>
                        Ajouter à la timeline
                    </button>
                    <button
                        onClick={() => handleRename(contextMenu.media)}
                        className="w-full px-3 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Renommer
                    </button>
                    <div className="border-t border-gray-700 my-1" />
                    <button
                        onClick={() => handleDelete(contextMenu.media)}
                        className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-red-900/50 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Supprimer
                    </button>
                    <div className="border-t border-gray-700 my-1" />
                    <div className="px-3 py-1.5 text-[10px] text-gray-500">
                        {formatSize(contextMenu.media.sizeBytes)} • {contextMenu.media.mimeType.split('/')[1]}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default BinManager;
