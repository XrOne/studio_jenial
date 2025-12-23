/**
 * DecoupageTechnique.tsx
 * 
 * Professional cinema shotlist component for the "Découpage" mode.
 * Displays shots in a table format with edit capabilities per row.
 */
import React, { useState } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from './icons';

export interface ShotEntry {
    id: string;
    number: number;
    valeur: string;     // Plan large, moyen, serré, etc.
    cadrage: string;    // Face, profil, 3/4, etc.
    mouvement: string;  // Fixe, travelling, panoramique, etc.
    action: string;     // Description de l'action
    prompt: string;     // Le prompt Veo généré
}

interface DecoupageTechniqueProps {
    shots: ShotEntry[];
    onUpdateShot: (id: string, updates: Partial<ShotEntry>) => void;
    onDeleteShot: (id: string) => void;
    onAddShot: () => void;
    onReorderShots?: (shots: ShotEntry[]) => void;
    isReadOnly?: boolean;
}

const VALEUR_OPTIONS = [
    'Plan d\'ensemble',
    'Plan large',
    'Plan moyen',
    'Plan américain',
    'Plan rapproché',
    'Gros plan',
    'Très gros plan',
    'Insert',
];

const CADRAGE_OPTIONS = [
    'Face',
    'Profil gauche',
    'Profil droit',
    '3/4 face',
    '3/4 dos',
    'Dos',
    'Plongée',
    'Contre-plongée',
];

const MOUVEMENT_OPTIONS = [
    'Fixe',
    'Travelling avant',
    'Travelling arrière',
    'Travelling latéral',
    'Panoramique',
    'Tilt up',
    'Tilt down',
    'Steadicam',
    'Dolly zoom',
];

export const DecoupageTechnique: React.FC<DecoupageTechniqueProps> = ({
    shots,
    onUpdateShot,
    onDeleteShot,
    onAddShot,
    isReadOnly = false,
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<Partial<ShotEntry>>({});

    const startEdit = (shot: ShotEntry) => {
        setEditingId(shot.id);
        setEditBuffer({
            valeur: shot.valeur,
            cadrage: shot.cadrage,
            mouvement: shot.mouvement,
            action: shot.action,
            prompt: shot.prompt,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditBuffer({});
    };

    const saveEdit = () => {
        if (editingId) {
            onUpdateShot(editingId, editBuffer);
            setEditingId(null);
            setEditBuffer({});
        }
    };

    return (
        <div className="bg-gray-900/50 rounded-xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 bg-gray-800/50 border-b border-gray-700">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    Découpage Technique
                </h3>
                <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                    {shots.length} plan{shots.length > 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-800/30 text-gray-400 text-[10px] uppercase tracking-wider">
                        <tr>
                            <th className="px-3 py-2 text-left w-10">#</th>
                            <th className="px-3 py-2 text-left">Valeur</th>
                            <th className="px-3 py-2 text-left">Cadrage</th>
                            <th className="px-3 py-2 text-left">Mouvement</th>
                            <th className="px-3 py-2 text-left">Action</th>
                            {!isReadOnly && <th className="px-3 py-2 text-center w-20">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {shots.map((shot) => (
                            <tr
                                key={shot.id}
                                className={`hover:bg-gray-800/40 transition-colors ${editingId === shot.id ? 'bg-indigo-900/20' : ''}`}
                            >
                                <td className="px-3 py-2 text-gray-500 font-mono">{shot.number}</td>

                                {editingId === shot.id ? (
                                    <>
                                        <td className="px-2 py-1">
                                            <select
                                                value={editBuffer.valeur || ''}
                                                onChange={(e) => setEditBuffer({ ...editBuffer, valeur: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                                            >
                                                {VALEUR_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1">
                                            <select
                                                value={editBuffer.cadrage || ''}
                                                onChange={(e) => setEditBuffer({ ...editBuffer, cadrage: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                                            >
                                                {CADRAGE_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1">
                                            <select
                                                value={editBuffer.mouvement || ''}
                                                onChange={(e) => setEditBuffer({ ...editBuffer, mouvement: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                                            >
                                                {MOUVEMENT_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1">
                                            <input
                                                type="text"
                                                value={editBuffer.action || ''}
                                                onChange={(e) => setEditBuffer({ ...editBuffer, action: e.target.value })}
                                                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                                                placeholder="Description de l'action..."
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex justify-center gap-1">
                                                <button
                                                    onClick={saveEdit}
                                                    className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-white"
                                                    title="Valider"
                                                >
                                                    <CheckIcon className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white"
                                                    title="Annuler"
                                                >
                                                    <XMarkIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-3 py-2 text-white">{shot.valeur}</td>
                                        <td className="px-3 py-2 text-gray-300">{shot.cadrage}</td>
                                        <td className="px-3 py-2 text-gray-300">{shot.mouvement}</td>
                                        <td className="px-3 py-2 text-gray-400 max-w-xs truncate" title={shot.action}>
                                            {shot.action}
                                        </td>
                                        {!isReadOnly && (
                                            <td className="px-3 py-2">
                                                <div className="flex justify-center gap-1">
                                                    <button
                                                        onClick={() => startEdit(shot)}
                                                        className="p-1.5 bg-gray-700 hover:bg-indigo-600 rounded text-gray-300 hover:text-white transition-colors"
                                                        title="Modifier"
                                                    >
                                                        <PencilIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteShot(shot.id)}
                                                        className="p-1.5 bg-gray-700 hover:bg-red-600 rounded text-gray-300 hover:text-white transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Button */}
            {!isReadOnly && (
                <div className="px-4 py-3 border-t border-gray-700">
                    <button
                        onClick={onAddShot}
                        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Ajouter un plan
                    </button>
                </div>
            )}

            {/* Prompt Preview (collapsed by default) */}
            {shots.length > 0 && (
                <details className="border-t border-gray-700">
                    <summary className="px-4 py-2 text-xs text-gray-500 hover:text-gray-400 cursor-pointer">
                        Voir les prompts Veo générés
                    </summary>
                    <div className="px-4 pb-3 space-y-2">
                        {shots.map((shot) => (
                            <div key={shot.id} className="text-[10px] text-gray-400 bg-gray-800/50 p-2 rounded">
                                <span className="font-bold text-gray-300">Plan {shot.number}: </span>
                                {shot.prompt || <em className="text-gray-500">Prompt non généré</em>}
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};

export default DecoupageTechnique;
