/**
 * FileMenuBar Component
 * Classic desktop-style File menu for project management
 */

import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../hooks/useProject';
import {
    FolderIcon,
    FolderOpenIcon,
    DownloadIcon,
    PlusIcon,
    CheckIcon,
} from './icons';

interface FileMenuBarProps {
    onOpenProjectManager: () => void;
}

export const FileMenuBar: React.FC<FileMenuBarProps> = ({ onOpenProjectManager }) => {
    const {
        project,
        isDirty,
        createProject,
        saveProject,
        exportProject,
        importProject,
    } = useProject();

    const [isOpen, setIsOpen] = useState(false);
    const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        // Ctrl+Shift+S = Save As (Export)
                        handleExport();
                    } else {
                        // Ctrl+S = Save
                        handleSave();
                    }
                } else if (e.key === 'o') {
                    e.preventDefault();
                    onOpenProjectManager();
                } else if (e.key === 'n') {
                    e.preventDefault();
                    setIsNewProjectDialogOpen(true);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSave = () => {
        saveProject();
        setIsOpen(false);
    };

    const handleExport = async () => {
        await exportProject();
        setIsOpen(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await importProject(file);
        }
        e.target.value = '';
        setIsOpen(false);
    };

    const handleNewProject = () => {
        if (newProjectName.trim()) {
            createProject(newProjectName.trim());
            setNewProjectName('');
            setIsNewProjectDialogOpen(false);
            setIsOpen(false);
        }
    };

    return (
        <>
            <div ref={menuRef} className="relative">
                {/* Menu Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded transition-colors ${isOpen
                            ? 'bg-gray-700 text-white'
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                        }`}
                >
                    <FolderIcon className="w-4 h-4" />
                    Fichier
                    {isDirty && <span className="w-2 h-2 bg-yellow-400 rounded-full" title="Modifications non sauvegardées" />}
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                        {/* Project Name Header */}
                        {project && (
                            <div className="px-3 py-2 border-b border-gray-700">
                                <p className="text-xs text-gray-400">Projet actif</p>
                                <p className="text-sm font-medium text-white truncate">{project.name}</p>
                            </div>
                        )}

                        {/* Menu Items */}
                        <MenuItem
                            icon={<PlusIcon className="w-4 h-4" />}
                            label="Nouveau projet"
                            shortcut="Ctrl+N"
                            onClick={() => {
                                setIsNewProjectDialogOpen(true);
                                setIsOpen(false);
                            }}
                        />
                        <MenuItem
                            icon={<FolderOpenIcon className="w-4 h-4" />}
                            label="Ouvrir projet..."
                            shortcut="Ctrl+O"
                            onClick={() => {
                                onOpenProjectManager();
                                setIsOpen(false);
                            }}
                        />

                        <div className="border-t border-gray-700 my-1" />

                        <MenuItem
                            icon={<CheckIcon className="w-4 h-4" />}
                            label="Enregistrer"
                            shortcut="Ctrl+S"
                            onClick={handleSave}
                            disabled={!project}
                        />
                        <MenuItem
                            icon={<DownloadIcon className="w-4 h-4" />}
                            label="Enregistrer sous..."
                            shortcut="Ctrl+Shift+S"
                            onClick={handleExport}
                            disabled={!project}
                        />

                        <div className="border-t border-gray-700 my-1" />

                        <MenuItem
                            icon={<FolderOpenIcon className="w-4 h-4" />}
                            label="Importer projet (.jenial)"
                            onClick={() => fileInputRef.current?.click()}
                        />

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jenial"
                            onChange={handleImport}
                            className="hidden"
                        />
                    </div>
                )}
            </div>

            {/* New Project Dialog */}
            {isNewProjectDialogOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Nouveau Projet</h3>
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Nom du projet..."
                            autoFocus
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none mb-4"
                            onKeyDown={(e) => e.key === 'Enter' && handleNewProject()}
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setIsNewProjectDialogOpen(false)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleNewProject}
                                disabled={!newProjectName.trim()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Créer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Menu Item Component
interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, shortcut, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${disabled
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
    >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {shortcut && <span className="text-xs text-gray-500">{shortcut}</span>}
    </button>
);

export default FileMenuBar;
