import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookMarkedIcon,
    FilmIcon,
    UsersIcon,
    DownloadIcon,
    UploadCloudIcon,
    KeyIcon,
    PlusIcon,
    ExternalLinkIcon,
} from './icons';

interface DropdownItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    divider?: boolean;
    disabled?: boolean;
    variant?: 'default' | 'danger';
}

interface DropdownMenuProps {
    trigger: React.ReactNode;
    items: DropdownItem[];
    align?: 'left' | 'right';
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, items, align = 'left' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700/80 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
                {trigger}
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden`}
                    >
                        {items.map((item, index) => (
                            <React.Fragment key={index}>
                                {item.divider && <div className="h-px bg-gray-700 my-1" />}
                                <button
                                    onClick={() => {
                                        if (!item.disabled) {
                                            item.onClick();
                                            setIsOpen(false);
                                        }
                                    }}
                                    disabled={item.disabled}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${item.disabled
                                        ? 'text-gray-500 cursor-not-allowed'
                                        : item.variant === 'danger'
                                            ? 'text-red-400 hover:bg-red-500/10'
                                            : 'text-gray-200 hover:bg-gray-700/50'
                                        }`}
                                >
                                    {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                                    <span>{item.label}</span>
                                </button>
                            </React.Fragment>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// BIBLIOTHEQUES MENU
// ============================================
interface LibraryMenuProps {
    onOpenShotLibrary: () => void;
    onOpenCharacters: () => void;
    onOpenDogmas: () => void;
    activeDogma: { title: string } | null;
}

export const LibraryMenu: React.FC<LibraryMenuProps> = ({
    onOpenShotLibrary,
    onOpenCharacters,
    onOpenDogmas,
    activeDogma,
}) => {
    const items: DropdownItem[] = [
        {
            label: 'Shot Library',
            icon: <FilmIcon className="w-5 h-5" />,
            onClick: onOpenShotLibrary,
        },
        {
            label: 'Characters',
            icon: <UsersIcon className="w-5 h-5" />,
            onClick: onOpenCharacters,
        },
        {
            label: activeDogma ? `Dogma: ${activeDogma.title}` : 'Dogmas',
            icon: <BookMarkedIcon className="w-5 h-5" />,
            onClick: onOpenDogmas,
        },
    ];

    return (
        <DropdownMenu
            trigger={
                <>
                    <FilmIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Bibliothèques</span>
                </>
            }
            items={items}
        />
    );
};

// ============================================
// PROJECT MENU
// ============================================
interface ProjectMenuProps {
    onNewProject: () => void;
    onSaveCloud: () => void;
    onLoadCloud: () => void;
    onExportJSON: () => void;
    onImportJSON: () => void;
    onOpenHistory: () => void;
    onCleanHistory: () => void; // Permet de nettoyer les projets corrompus
    isSaving: boolean;
    isAuthenticated: boolean;
}

export const ProjectMenu: React.FC<ProjectMenuProps> = ({
    onNewProject,
    onSaveCloud,
    onLoadCloud,
    onExportJSON,
    onImportJSON,
    onOpenHistory,
    onCleanHistory,
    isSaving,
    isAuthenticated,
}) => {
    const items: DropdownItem[] = [
        {
            label: 'Nouveau projet',
            icon: <PlusIcon className="w-5 h-5" />,
            onClick: onNewProject,
        },
        { label: '', divider: true, onClick: () => { } },
        {
            label: isSaving ? 'Sauvegarde...' : 'Sauvegarder (Cloud)',
            icon: <UploadCloudIcon className="w-5 h-5" />,
            onClick: onSaveCloud,
            disabled: !isAuthenticated || isSaving,
        },
        {
            label: 'Charger un projet',
            icon: <DownloadIcon className="w-5 h-5" />,
            onClick: onLoadCloud,
            disabled: !isAuthenticated,
        },
        { label: '', divider: true, onClick: () => { } },
        {
            label: 'Exporter JSON',
            icon: <DownloadIcon className="w-5 h-5" />,
            onClick: onExportJSON,
        },
        {
            label: 'Importer JSON',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                </svg>
            ),
            onClick: onImportJSON,
        },
        { label: '', divider: true, onClick: () => { } },
        {
            label: 'Historique sessions',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            onClick: onOpenHistory,
        },
        {
            label: '🧹 Nettoyer l\'historique',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            ),
            onClick: onCleanHistory,
            disabled: !isAuthenticated,
            variant: 'danger',
        },
    ];

    return (
        <DropdownMenu
            trigger={
                <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="hidden sm:inline">Projet</span>
                </>
            }
            items={items}
        />
    );
};

// ============================================
// PROFILE MENU
// ============================================
interface ProfileMenuProps {
    user: { email?: string; user_metadata?: { avatar_url?: string; full_name?: string } } | null;
    hasApiKey: boolean;
    onOpenApiKey: () => void;
    onOpenProfile: () => void;
    onOpenStorageSettings: () => void;
    onSignOut: () => void;
    onSignIn: () => void;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
    user,
    hasApiKey,
    onOpenApiKey,
    onOpenProfile,
    onOpenStorageSettings,
    onSignOut,
    onSignIn,
}) => {
    if (!user) {
        return (
            <button
                onClick={onSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connexion Google
            </button>
        );
    }

    const items: DropdownItem[] = [
        {
            label: 'Mon profil',
            icon: <UsersIcon className="w-5 h-5" />,
            onClick: onOpenProfile,
        },
        {
            label: hasApiKey ? '✓ Clé API configurée' : 'Configurer clé API',
            icon: <KeyIcon className="w-5 h-5" />,
            onClick: onOpenApiKey,
        },
        {
            label: '💾 Stockage vidéos',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
            ),
            onClick: onOpenStorageSettings,
        },
        { label: '', divider: true, onClick: () => { } },
        {
            label: 'Déconnexion',
            icon: <ExternalLinkIcon className="w-5 h-5" />,
            onClick: onSignOut,
            variant: 'danger',
        },
    ];

    const avatarUrl = user.user_metadata?.avatar_url;
    const initial = user.email?.[0]?.toUpperCase() || '?';

    return (
        <DropdownMenu
            trigger={
                avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {initial}
                    </div>
                )
            }
            items={items}
            align="right"
        />
    );
};
