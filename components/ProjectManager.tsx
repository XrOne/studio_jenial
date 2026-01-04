/**
 * ProjectManager Component
 * UI for creating, opening, and exporting projects
 * Clear UX for project persistence and safety
 */

import React, { useState, useRef } from 'react';
import { useProject } from '../hooks/useProject';
import { Project } from '../types/project';
import {
    FolderOpenIcon,
    PlusIcon,
    DownloadIcon,
    FolderIcon,
    CheckIcon,
    ExclamationTriangleIcon,
} from './icons';

interface ProjectManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectChange?: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
    isOpen,
    onClose,
    onProjectChange,
}) => {
    const {
        project,
        projects,
        isDirty,
        createProject,
        openProject,
        saveProject,
        exportProject,
        importProject,
        deleteProject,
    } = useProject();

    const [newProjectName, setNewProjectName] = useState('');
    const [showNewProject, setShowNewProject] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (newProjectName.trim()) {
            createProject(newProjectName.trim());
            setNewProjectName('');
            setShowNewProject(false);
            onProjectChange?.();
            onClose();
        }
    };

    const handleOpen = (id: string) => {
        // Warn if current project has unsaved changes
        if (isDirty) {
            if (!confirm('Vous avez des modifications non sauvegardées. Voulez-vous vraiment ouvrir un autre projet?')) {
                return;
            }
        }
        openProject(id);
        onProjectChange?.();
        onClose();
    };

    const handleExport = async () => {
        setIsExporting(true);
        await exportProject();
        setIsExporting(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const success = await importProject(file);
            if (success) {
                onProjectChange?.();
                onClose();
            } else {
                alert('Échec de l\'import du projet. Vérifiez que le fichier est valide.');
            }
        }
        e.target.value = '';
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer le projet "${name}"? Cette action est irréversible.`)) {
            deleteProject(id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700 shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <FolderIcon className="w-7 h-7 text-indigo-400" />
                        Gestionnaire de Projets
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Vos projets sont sauvegardés localement sur votre machine
                    </p>
                </div>

                {/* Current Project Status */}
                {project && (
                    <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400">Projet actif</p>
                                <p className="text-lg font-semibold text-white">{project.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isDirty ? (
                                    <span className="flex items-center gap-2 text-yellow-400 text-sm">
                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                        Modifications non sauvegardées
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-green-400 text-sm">
                                        <CheckIcon className="w-4 h-4" />
                                        Sauvegardé
                                    </span>
                                )}
                                <button
                                    onClick={() => saveProject()}
                                    disabled={!isDirty}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                                >
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Safety Info */}
                <div className="px-6 py-3 bg-blue-900/20 border-b border-blue-800/30">
                    <p className="text-blue-300 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <strong>Conseil:</strong> Exportez régulièrement votre projet (.jenial) pour une sauvegarde externe
                    </p>
                </div>

                {/* Actions */}
                <div className="p-4 flex flex-wrap gap-3 border-b border-gray-700">
                    <button
                        onClick={() => setShowNewProject(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Nouveau Projet
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                        <FolderOpenIcon className="w-5 h-5" />
                        Importer (.jenial)
                    </button>
                    {project && (
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            {isExporting ? 'Export...' : 'Exporter Projet'}
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jenial"
                        onChange={handleImport}
                        className="hidden"
                    />
                </div>

                {/* New Project Form */}
                {showNewProject && (
                    <div className="px-6 py-4 bg-gray-800/30 border-b border-gray-700">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="Nom du projet..."
                                autoFocus
                                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                            <button
                                onClick={handleCreate}
                                disabled={!newProjectName.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                Créer
                            </button>
                            <button
                                onClick={() => setShowNewProject(false)}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                )}

                {/* Projects List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {projects.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <FolderIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>Aucun projet. Créez-en un pour commencer!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projects.map((p) => (
                                <div
                                    key={p.id}
                                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${project?.id === p.id
                                            ? 'bg-indigo-900/30 border-indigo-600'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold text-white">{p.name}</p>
                                        <p className="text-xs text-gray-400">
                                            Créé: {new Date(p.createdAt).toLocaleDateString()} •
                                            Modifié: {new Date(p.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {project?.id !== p.id && (
                                            <button
                                                onClick={() => handleOpen(p.id)}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                                            >
                                                Ouvrir
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(p.id, p.name)}
                                            className="px-3 py-1.5 bg-red-800/50 hover:bg-red-700 text-red-200 text-sm rounded-lg transition-colors"
                                        >
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectManager;
