/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ThemeSwitcher - UI component for selecting themes
 * Variants: minimal, compact, dropdown, full
 */
import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeId, ThemeTokens } from '../styles/themes';

// Theme Icons
const ThemeIcon: React.FC<{ themeId: ThemeId; className?: string }> = ({ themeId, className = '' }) => {
    const iconClass = `material-symbols-outlined ${className}`;
    switch (themeId) {
        case 'terminal':
            return <span className={iconClass}>terminal</span>;
        case 'cinematic':
            return <span className={iconClass}>movie</span>;
        case 'neon':
            return <span className={iconClass}>auto_awesome</span>;
    }
};

interface ThemeSwitcherProps {
    variant?: 'full' | 'compact' | 'dropdown' | 'minimal';
    onClose?: () => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'full', onClose }) => {
    const { themeId, setThemeId, themes, theme, cycleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    // === MINIMAL: Just an icon button that cycles themes ===
    if (variant === 'minimal') {
        return (
            <button
                onClick={cycleTheme}
                className="p-2 rounded-lg transition-all hover:scale-110"
                style={{
                    color: theme.colors.textMuted,
                    background: 'transparent',
                }}
                title={`Thème: ${theme.name} (cliquer pour changer)`}
            >
                <ThemeIcon themeId={themeId} className="text-xl" />
            </button>
        );
    }

    // === COMPACT: Horizontal button group ===
    if (variant === 'compact') {
        return (
            <div className="flex gap-1 p-1" style={{ background: theme.colors.surface, borderRadius: theme.radius.md }}>
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setThemeId(t.id)}
                        className="flex items-center gap-2 px-3 py-2 transition-all"
                        style={{
                            background: themeId === t.id ? t.colors.accentMuted : 'transparent',
                            color: themeId === t.id ? t.colors.accent : t.colors.textMuted,
                            borderRadius: theme.radius.sm,
                            border: themeId === t.id ? `1px solid ${t.colors.borderActive}` : '1px solid transparent',
                            fontFamily: theme.fonts.body,
                            fontSize: '12px',
                            fontWeight: themeId === t.id ? 600 : 400,
                        }}
                    >
                        <ThemeIcon themeId={t.id} className="text-base" />
                        {t.name}
                    </button>
                ))}
            </div>
        );
    }

    // === DROPDOWN: Collapsible menu ===
    if (variant === 'dropdown') {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 transition-colors"
                    style={{
                        background: theme.colors.surface,
                        color: theme.colors.text,
                        borderRadius: theme.radius.md,
                        border: `1px solid ${theme.colors.border}`,
                        fontFamily: theme.fonts.body,
                        fontSize: '12px',
                    }}
                >
                    <ThemeIcon themeId={themeId} className="text-base" />
                    {theme.name}
                    <span className="material-symbols-outlined text-sm" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        expand_more
                    </span>
                </button>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div
                            className="absolute top-full left-0 mt-1 min-w-[200px] z-50 py-1"
                            style={{
                                background: theme.colors.surface,
                                borderRadius: theme.radius.md,
                                border: `1px solid ${theme.colors.border}`,
                                boxShadow: theme.shadows.lg,
                            }}
                        >
                            {themes.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => { setThemeId(t.id); setIsOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                                    style={{
                                        background: themeId === t.id ? t.colors.accentMuted : 'transparent',
                                        color: themeId === t.id ? t.colors.text : theme.colors.textMuted,
                                        fontFamily: theme.fonts.body,
                                        fontSize: '12px',
                                    }}
                                >
                                    <div
                                        className="w-6 h-6 flex items-center justify-center rounded"
                                        style={{ background: t.colors.bg, border: `1px solid ${t.colors.border}` }}
                                    >
                                        <ThemeIcon themeId={t.id} className="text-sm" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                                        <span style={{ fontSize: '10px', color: theme.colors.textMuted }}>{t.subtitle}</span>
                                    </div>
                                    {themeId === t.id && (
                                        <span className="material-symbols-outlined ml-auto text-base" style={{ color: t.colors.accent }}>
                                            check
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // === FULL: Modal with theme previews ===
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl"
                style={{
                    background: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    border: `1px solid ${theme.colors.border}`,
                    boxShadow: theme.shadows.lg,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.colors.border }}>
                    <div>
                        <h2 className="text-lg font-semibold" style={{ color: theme.colors.text, fontFamily: theme.fonts.heading }}>
                            Apparence
                        </h2>
                        <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
                            Choisissez votre skin préféré
                        </p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: theme.colors.textMuted }}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                {/* Theme Cards */}
                <div className="p-6 grid grid-cols-3 gap-4">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setThemeId(t.id)}
                            className="group flex flex-col overflow-hidden transition-all hover:scale-[1.02]"
                            style={{
                                background: t.colors.bg,
                                borderRadius: t.radius.lg || '4px',
                                border: `2px solid ${themeId === t.id ? t.colors.borderActive : t.colors.border}`,
                                boxShadow: themeId === t.id ? t.shadows.accent : 'none',
                            }}
                        >
                            {/* Preview */}
                            <div className="h-24 p-3" style={{ background: t.colors.bg }}>
                                <div className="h-full flex gap-2">
                                    {/* Mini sidebar */}
                                    <div
                                        className="w-8 h-full flex flex-col gap-1 p-1"
                                        style={{ background: t.colors.surface, borderRadius: t.radius.sm }}
                                    >
                                        <div className="w-full aspect-square" style={{ background: t.colors.accent, borderRadius: t.radius.sm }} />
                                        <div className="w-full aspect-square" style={{ background: t.colors.border, borderRadius: t.radius.sm }} />
                                    </div>
                                    {/* Mini content */}
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div
                                            className="flex-1"
                                            style={{ background: t.colors.surface, borderRadius: t.radius.sm }}
                                        >
                                            <div className="h-2 w-3/4 m-2" style={{ background: t.colors.border, borderRadius: t.radius.sm }} />
                                            <div className="h-2 w-1/2 m-2" style={{ background: t.colors.border, borderRadius: t.radius.sm }} />
                                        </div>
                                        {/* Mini timeline */}
                                        <div
                                            className="h-6 flex gap-1 p-1"
                                            style={{ background: t.colors.surface, borderRadius: t.radius.sm }}
                                        >
                                            <div className="flex-1" style={{ background: t.colors.trackVideo, borderRadius: t.radius.sm }} />
                                            <div className="flex-1" style={{ background: t.colors.trackVideoActive, borderRadius: t.radius.sm }} />
                                            <div className="flex-1" style={{ background: t.colors.trackVideo, borderRadius: t.radius.sm }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Label */}
                            <div className="p-3 flex items-center gap-2" style={{ background: t.colors.surface }}>
                                <ThemeIcon themeId={t.id} className="text-lg" />
                                <div className="flex-1 text-left">
                                    <div
                                        className="text-sm font-semibold"
                                        style={{
                                            color: themeId === t.id ? t.colors.accent : t.colors.text,
                                            fontFamily: t.fonts.heading,
                                        }}
                                    >
                                        {t.name}
                                    </div>
                                    <div className="text-xs" style={{ color: t.colors.textMuted }}>
                                        {t.subtitle}
                                    </div>
                                </div>
                                {themeId === t.id && (
                                    <span className="material-symbols-outlined" style={{ color: t.colors.accent }}>
                                        check_circle
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-between p-4 border-t text-sm"
                    style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}
                >
                    <span>Le thème est sauvegardé automatiquement</span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium transition-colors"
                            style={{
                                background: theme.colors.accent,
                                color: theme.id === 'neon' ? '#fff' : theme.colors.bg,
                                borderRadius: theme.radius.md,
                            }}
                        >
                            Fermer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThemeSwitcher;
