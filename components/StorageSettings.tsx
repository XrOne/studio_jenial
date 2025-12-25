import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isDriveEnabled, isDriveConnected, connectDrive } from '../services/googleDriveClient';
import { ProjectService } from '../services/projectService';

interface StorageSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [storageMode, setStorageMode] = useState<'google-drive' | 'local-download'>('local-download'); // Default to local
    const [driveEnabled, setDriveEnabled] = useState(false);
    const [driveConnected, setDriveConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            loadSettings();
        }
    }, [isOpen, user]);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            // Check if Drive is enabled on server
            const enabled = await isDriveEnabled();
            setDriveEnabled(enabled);

            if (enabled) {
                // Check if user has connected Drive
                const connected = await isDriveConnected();
                setDriveConnected(connected);
            }

            // Load user preference from profile
            if (user) {
                const profile = await ProjectService.getProfile(user.id);
                if (profile?.preferences?.videoStorage) {
                    setStorageMode(profile.preferences.videoStorage);
                } else {
                    // Default to Google Drive as requested regarding storage costs
                    setStorageMode('google-drive');
                }
            }
        } catch (error) {
            console.error('[StorageSettings] Error loading settings:', error);
            // On error, default to local (safest option)
            setStorageMode('local-download');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        try {
            // Save preference to Supabase profile
            await ProjectService.updateProfile(user.id, {
                preferences: {
                    videoStorage: storageMode
                }
            });

            alert('✅ Préférences sauvegardées!');
            onClose();
        } catch (error) {
            console.error('[StorageSettings] Error saving:', error);
            alert('❌ Erreur lors de la sauvegarde');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConnectDrive = async () => {
        try {
            await connectDrive();
        } catch (error) {
            console.error('[StorageSettings] Error connecting Drive:', error);
            alert('❌ Erreur lors de la connexion à Google Drive');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Stockage Vidéos</h2>
                            <p className="text-sm text-gray-400">Configuration de l'emplacement de sauvegarde</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-400">Chargement...</div>
                    ) : (
                        <>
                            {/* Option 1: Google Drive */}
                            <label className="block">
                                <div className="flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-indigo-500/50 group" style={{
                                    borderColor: storageMode === 'google-drive' ? '#6366f1' : '#374151',
                                    backgroundColor: storageMode === 'google-drive' ? '#312e81' : 'transparent'
                                }}>
                                    <input
                                        type="radio"
                                        value="google-drive"
                                        checked={storageMode === 'google-drive'}
                                        onChange={() => setStorageMode('google-drive')}
                                        className="mt-1"
                                        disabled={!driveEnabled}
                                    />
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M7.71 3.5L1.15 15l3.8 6.5L11.5 10 7.71 3.5zm6.58 0L10.5 10l3.8 6.5 6.5-11.3-6.5-1.7zm-7.95 13l-2.5 4.5h10l2.5-4.5h-10z" />
                                            </svg>
                                            <strong className="text-white text-lg">Google Drive</strong>
                                            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Recommandé</span>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-3">
                                            Sauvegarde automatique dans votre Drive personnel (dossier "Studio Jenial")
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">✓ Multi-appareils</span>
                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">✓ Permanent</span>
                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">✓ 15GB gratuit</span>
                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">✓ Partage facile</span>
                                        </div>

                                        {!driveEnabled && (
                                            <p className="mt-3 text-yellow-500 text-sm">⚠️ Non configuré sur le serveur</p>
                                        )}

                                        {driveEnabled && !driveConnected && storageMode === 'google-drive' && (
                                            <button
                                                onClick={handleConnectDrive}
                                                className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                                Connecter Google Drive
                                            </button>
                                        )}

                                        {driveConnected && (
                                            <p className="mt-3 text-green-400 text-sm flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Google Drive connecté
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </label>

                            {/* Option 2: Local Download */}
                            <label className="block">
                                <div className="flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-indigo-500/50 group" style={{
                                    borderColor: storageMode === 'local-download' ? '#6366f1' : '#374151',
                                    backgroundColor: storageMode === 'local-download' ? '#312e81' : 'transparent'
                                }}>
                                    <input
                                        type="radio"
                                        value="local-download"
                                        checked={storageMode === 'local-download'}
                                        onChange={() => setStorageMode('local-download')}
                                        className="mt-1"
                                    />
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <strong className="text-white text-lg">Téléchargement Local</strong>
                                        </div>
                                        <p className="text-gray-300 text-sm mb-3">
                                            Fichiers .mp4 enregistrés directement sur votre ordinateur
                                        </p>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">✓ Contrôle total</span>
                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">✓ Privé</span>
                                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded">✓ Espace illimité</span>
                                        </div>
                                        <div className="mt-3 text-xs text-yellow-500 flex items-start gap-2">
                                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span>Vous devrez réimporter manuellement les fichiers pour restaurer les shots sauvegardés</span>
                                        </div>
                                    </div>
                                </div>
                            </label>

                            {/* Privacy Info */}
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                                <p className="text-sm text-indigo-100 flex items-start gap-2">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span>
                                        <strong className="text-white">Vie privée garantie:</strong> Vos vidéos ne sont JAMAIS stockées
                                        sur nos serveurs. Vous gardez le contrôle total de vos données.
                                    </span>
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800 bg-gray-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Sauvegarde...
                            </>
                        ) : (
                            'Enregistrer'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
