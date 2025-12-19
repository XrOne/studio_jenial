import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { ProjectService } from '../services/projectService';
import { Project, UserProfile } from '../types';
import {
    UsersIcon,
    SlidersHorizontalIcon,
    ExternalLinkIcon,
    LayoutGridIcon,
    PlusIcon,
    Trash2Icon,
    UploadCloudIcon,
    XMarkIcon,
    SparklesIcon
} from './icons';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProject: Project | null;
    onLoadProject: (project: Project) => void;
    onNewProject: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    currentProject,
    onLoadProject,
    onNewProject
}) => {
    const { user, signInWithGoogle, signOut, loading, providerToken } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [activeTab, setActiveTab] = useState<'projects' | 'settings'>('projects');

    // Profile State
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            loadProjects();
            loadProfile();
        }
    }, [isOpen, user]);

    const loadProjects = async () => {
        if (!user) return;
        setIsLoadingProjects(true);
        try {
            const list = await ProjectService.listProjects(user.id);
            setProjects(list);
        } catch (e) {
            console.error('Failed to list projects:', e);
        } finally {
            setIsLoadingProjects(false);
        }
    };

    const loadProfile = async () => {
        if (!user) return;
        try {
            const p = await ProjectService.getProfile(user.id);
            if (p) {
                setProfile(p);
                setApiKey(p.api_key || '');
            } else {
                // Init profile from user metadata if not exists
                setProfile({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata.full_name,
                    avatar_url: user.user_metadata.avatar_url
                });
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
        }
    };

    const handleSaveProfile = async () => {
        if (!user) return;
        setIsSavingProfile(true);
        try {
            await ProjectService.updateProfile(user.id, {
                api_key: apiKey
            });
            // Update local state
            setProfile(prev => prev ? { ...prev, api_key: apiKey } : null);
            alert('Profile saved!');
        } catch (e) {
            console.error('Failed to save profile:', e);
            alert('Error saving profile');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await ProjectService.deleteProject(id);
            loadProjects();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-4xl bg-[#1a1a1a] border border-gray-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {user?.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full rounded-full" />
                                ) : (
                                    <UsersIcon className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {user ? (user.user_metadata?.full_name || user.email) : 'Welcome to Studio Jenial'}
                                </h2>
                                <p className="text-xs text-gray-400">
                                    {user ? 'Creative Director' : 'Sign in to access your projects'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-grow flex overflow-hidden">
                        {!user ? (
                            <div className="w-full flex flex-col items-center justify-center p-12 text-center">
                                <SparklesIcon className="w-16 h-16 text-indigo-500 mb-6" />
                                <h3 className="text-2xl font-bold text-white mb-2">Sync Your Creativity</h3>
                                <p className="text-gray-400 mb-8 max-w-md">
                                    Sign in to save your prompts, storyboards, and videos. Access your workspace from anywhere.
                                </p>
                                <button
                                    onClick={signInWithGoogle}
                                    className="flex items-center gap-3 bg-white text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
                                    Sign in with Google
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Sidebar */}
                                <div className="w-64 bg-gray-900/50 border-r border-gray-800 p-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => setActiveTab('projects')}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${activeTab === 'projects' ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            }`}
                                    >
                                        <LayoutGridIcon className="w-5 h-5" />
                                        <div className="font-medium">Projects</div>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('settings')}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${activeTab === 'settings' ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            }`}
                                    >
                                        <SlidersHorizontalIcon className="w-5 h-5" />
                                        <div className="font-medium">Settings</div>
                                    </button>

                                    <div className="flex-grow" />

                                    <button
                                        onClick={signOut}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <ExternalLinkIcon className="w-5 h-5" />
                                        <div className="font-medium">Sign Out</div>
                                    </button>
                                </div>

                                {/* Main Area */}
                                <div className="flex-grow p-8 overflow-y-auto bg-[#1a1a1a]">
                                    {activeTab === 'projects' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-xl font-bold text-white">Your Projects</h3>
                                                <button
                                                    onClick={onNewProject}
                                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                                                >
                                                    <PlusIcon className="w-5 h-5" />
                                                    New Project
                                                </button>
                                            </div>

                                            {isLoadingProjects ? (
                                                <div className="text-center py-12 text-gray-500">Loading projects...</div>
                                            ) : projects.length === 0 ? (
                                                <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-2xl">
                                                    <LayoutGridIcon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                                                    <p className="text-gray-400">No projects yet. Start creating!</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {projects.map(p => (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => onLoadProject(p)}
                                                            className={`group relative bg-gray-800 border ${currentProject?.id === p.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-700 hover:border-gray-600'} rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg`}
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-bold text-white truncate pr-8">{p.title}</h4>
                                                                <button
                                                                    onClick={(e) => handleDeleteProject(p.id, e)}
                                                                    className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2Icon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-gray-500">
                                                                Updated {new Date(p.updated_at).toLocaleDateString()}
                                                            </p>
                                                            {currentProject?.id === p.id && (
                                                                <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'settings' && (
                                        <div className="max-w-xl space-y-8">
                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-4">Profile Settings</h3>
                                                <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700">
                                                    <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden">
                                                        {user.user_metadata.avatar_url && (
                                                            <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{user.user_metadata.full_name}</div>
                                                        <div className="text-sm text-gray-400">{user.email}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-xl font-bold text-white mb-4">API Configuration (BYOK)</h3>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-400 mb-1">
                                                            Google Gemini API Key
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={apiKey}
                                                            onChange={(e) => setApiKey(e.target.value)}
                                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 focus:outline-none"
                                                            placeholder="AIzaSy..."
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Stored securely in your profile preferences.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handleSaveProfile}
                                                        disabled={isSavingProfile}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                                                    >
                                                        {isSavingProfile ? 'Saving...' : 'Save Configuration'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
