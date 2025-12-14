import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioSession } from '../services/sessionService';

interface SessionHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: StudioSession[];
    onRestore: (session: StudioSession) => void;
    isLoading: boolean;
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
    isOpen,
    onClose,
    sessions,
    onRestore,
    isLoading
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="w-full max-w-2xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Historique des Sessions</h2>
                            <p className="text-sm text-white/40 mt-1">
                                Retrouvez vos travaux précédents. La sauvegarde est automatique.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-[#EB5A29] rounded-full animate-spin" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-12 text-white/20 italic">
                                Aucune session trouvée dans l'historique.
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="group flex flex-col p-4 bg-white/5 border border-white/5 hover:border-white/20 rounded-xl transition-all cursor-default"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-[#EB5A29]">
                                            {new Date(session.last_activity_at).toLocaleDateString()} à {new Date(session.last_activity_at).toLocaleTimeString()}
                                        </span>
                                        <button
                                            onClick={() => onRestore(session)}
                                            className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-white/10 hover:bg-[#EB5A29] text-xs font-medium rounded-lg transition-all"
                                        >
                                            Restaurer
                                        </button>
                                    </div>

                                    <div className="text-white/80 line-clamp-2 text-sm leading-relaxed">
                                        {session.main_prompt || <span className="text-white/30 italic">Piste vide</span>}
                                    </div>

                                    {/* Indicators */}
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-white/30">
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            {session.extension_prompts?.length || 0} extensions
                                        </div>
                                        {session.dogma_id && (
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                Dogma actif
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
