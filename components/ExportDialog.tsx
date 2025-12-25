import React, { useState, useEffect } from 'react';
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

    // Export Settings
    const [resolution, setResolution] = useState('1080p');
    const [fps, setFps] = useState('30');
    const [aiUpscale, setAiUpscale] = useState(false);
    const [aiUpscaleAvailable, setAiUpscaleAvailable] = useState(false);

    // Check AI upscale availability on mount
    useEffect(() => {
        if (isOpen) {
            fetch('/api/video/ai-upscale-status')
                .then(r => r.json())
                .then(data => setAiUpscaleAvailable(data.available))
                .catch(() => setAiUpscaleAvailable(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const exportOptions = {
        resolutions: [
            { label: 'HD (720p)', value: '720p', width: 1280, height: 720 },
            { label: 'Full HD (1080p)', value: '1080p', width: 1920, height: 1080 },
            { label: '2K (1440p)', value: '2k', width: 2560, height: 1440 },
            { label: '4K UHD (2160p)', value: '4k', width: 3840, height: 2160 },
        ],
        framerates: ['24', '25', '30', '60', '120']
    };

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

            console.log('[ExportDialog] Exporting URLs:', videoUrls, 'AI:', aiUpscale);

            const selectedRes = exportOptions.resolutions.find(r => r.value === resolution) || exportOptions.resolutions[1];

            // 2. Call backend fusion
            setProgress(aiUpscale ? 15 : 30); // AI upscale takes longer
            const response = await fetch('/api/video/combine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    videoUrls,
                    width: selectedRes.width,
                    height: selectedRes.height,
                    fps: parseInt(fps),
                    aiUpscale
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Erreur serveur: ${response.statusText}`);
            }

            setProgress(70);

            // 3. Download the result blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `studio_jenial_export_${resolution}_${fps}fps_${Date.now()}.mp4`;
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
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold text-white mb-2">Options d'Export</h2>
                <p className="text-gray-400 text-sm mb-6">Configurez la qualité de votre rendu final.</p>

                {/* Settings Grid */}
                {!isExporting && (
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        {/* Resolution */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Résolution</label>
                            <div className="space-y-2">
                                {exportOptions.resolutions.map((res) => (
                                    <button
                                        key={res.value}
                                        onClick={() => setResolution(res.value)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${resolution === res.value
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="font-bold">{res.label}</div>
                                        {res.value === '4k' && <div className="text-[10px] opacity-70">Upscaling IA Requis (Simulation)</div>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FPS */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Images par seconde</label>
                            <div className="grid grid-cols-2 gap-2">
                                {exportOptions.framerates.map((rate) => (
                                    <button
                                        key={rate}
                                        onClick={() => setFps(rate)}
                                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${fps === rate
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                                            }`}
                                    >
                                        {rate} FPS
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Upscale Toggle */}
                {!isExporting && aiUpscaleAvailable && (
                    <div className="mb-6">
                        <button
                            onClick={() => setAiUpscale(!aiUpscale)}
                            className={`w-full px-4 py-4 rounded-xl border-2 transition-all flex items-center gap-4 ${aiUpscale
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                                    : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'
                                }`}
                        >
                            <div className="text-2xl">{aiUpscale ? '✨' : '🎬'}</div>
                            <div className="text-left flex-1">
                                <div className="font-bold">
                                    {aiUpscale ? 'IA Super-Résolution Activée' : 'Activer l\'Upscaling IA'}
                                </div>
                                <div className="text-xs opacity-70">
                                    {aiUpscale
                                        ? 'Real-ESRGAN x2 - Qualité Pro (traitement long)'
                                        : 'Amélioration par modèle Real-ESRGAN'
                                    }
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full transition-all ${aiUpscale ? 'bg-purple-300' : 'bg-gray-600'}`}>
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all ${aiUpscale ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`}></div>
                            </div>
                        </button>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {isExporting ? (
                    <div className="space-y-4 py-8">
                        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 relative" style={{ width: `${progress}%` }}>
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                        <p className="text-center text-sm text-indigo-300 font-medium animate-pulse">
                            Traitement du rendu {resolution} @ {fps}fps...
                        </p>
                    </div>
                ) : (
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Exporter
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
