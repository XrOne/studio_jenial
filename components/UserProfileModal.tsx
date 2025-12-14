import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileModalProps {
    isOpen: boolean;
    onConfirm: (identifier: string) => void;
    isLoading: boolean;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onConfirm,
    isLoading
}) => {
    const [identifier, setIdentifier] = useState('');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 shadow-2xl"
                >
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                            Bienvenue sur Studio Jenial
                        </h2>
                        <p className="text-white/40">
                            Identifiez-vous pour sauvegarder votre travail et retrouver vos sessions.
                        </p>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (identifier.trim()) onConfirm(identifier.trim());
                        }}
                        className="space-y-6"
                    >
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-white/30 mb-2 ml-1">
                                Pseudo ou Email
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="ex: Jean-Michel Jarre"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#EB5A29] focus:ring-1 focus:ring-[#EB5A29] transition-colors"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!identifier.trim() || isLoading}
                            className="w-full flex items-center justify-center gap-2 bg-[#EB5A29] hover:bg-[#FF6B3D] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-colors"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Commencer'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-xs text-white/20">
                        Vos sessions seront sauvegardées automatiquement et liées à cet identifiant.
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
