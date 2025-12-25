import React, { useState } from 'react';
import { SegmentWithUI } from '../types/timeline';

interface ExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    segments: SegmentWithUI[];
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, segments }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        setProgress(10); // Start progress
        setError(null);

        try {
            // 1. Collect URLs (and filter out non-video segments if necessary)
            const videoUrls = segments
                .filter(s => s.activeRevision?.outputAsset?.kind === 'video' && s.activeRevision?.outputAsset?.url)
                .map(s => s.activeRevision!.outputAsset!.url!);

            if (videoUrls.length === 0) {
                throw new Error("Aucun clip vidéo à exporter.");
            }

            console.log('[ExportDialog] Exporting URLs:', videoUrls);
            setProgress(30);

            // 2. Call backend fusion
            const response = await fetch('/api/video/combine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoUrls })
            });

            if (!response.ok) {
                throw new Error(`Erreur serveur: ${response.statusText}`);
            }

            setProgress(70);

            // 3. Download the result blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `studio_jenial_export_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setProgress(100);
            setTimeout(() => {
                onClose();
                setIsExporting(false);
                setProgress(0);
            }, 1000);

        } catch (err) {
            console.error('[ExportDialog] Failed:', err);
            setError(err instanceof Error ? err.message : "Erreur inconnue");
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Exporter le Montage</h2>

                <div className="mb-6">
                    <p className="text-gray-300 mb-2">
                        Vous êtes sur le point d'exporter {segments.length} clips en un seul fichier MP4.
                    </p>
                    <p className="text-sm text-gray-500">
                        Le traitement se fait localement sur le serveur pour garantir la meilleure qualité.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {isExporting ? (
                    <div className="space-y-2">
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-center text-xs text-indigo-400">
                            Calcul en cours... {progress < 100 ? 'Veuillez patienter' : 'Téléchargement...'}
                        </p>
                    </div>
                ) : (
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Exporter MP4
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
