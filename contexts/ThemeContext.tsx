/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Theme Context - React Provider for theme management
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeId, ThemeTokens, themes, defaultThemeId, generateCSSVariables, themeList } from '../styles/themes';

interface ThemeContextValue {
    themeId: ThemeId;
    theme: ThemeTokens;
    themes: ThemeTokens[];
    setThemeId: (id: ThemeId) => void;
    cycleTheme: () => void;
    hasGlow: boolean;
    hasGrain: boolean;
    hasGlassmorphism: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = 'studio-jenial-theme';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: ThemeId;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultTheme }) => {
    const [themeId, setThemeIdState] = useState<ThemeId>(() => {
        if (typeof window === 'undefined') return defaultTheme || defaultThemeId;
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored && themes[stored as ThemeId]) return stored as ThemeId;
        return defaultTheme || defaultThemeId;
    });

    const theme = useMemo(() => themes[themeId], [themeId]);
    const hasGlow = theme.effects.glow;
    const hasGrain = theme.effects.grain;
    const hasGlassmorphism = theme.effects.glassmorphism;

    useEffect(() => {
        const root = document.documentElement;
        const variables = generateCSSVariables(theme);
        Object.entries(variables).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        document.body.classList.remove('theme-terminal', 'theme-cinematic', 'theme-neon');
        document.body.classList.add(`theme-${themeId}`);
        document.body.setAttribute('data-theme', themeId);
    }, [theme, themeId]);

    const setThemeId = useCallback((id: ThemeId) => {
        setThemeIdState(id);
        localStorage.setItem(THEME_STORAGE_KEY, id);
    }, []);

    const cycleTheme = useCallback(() => {
        const themeIds: ThemeId[] = ['terminal', 'cinematic', 'neon'];
        const currentIndex = themeIds.indexOf(themeId);
        const nextIndex = (currentIndex + 1) % themeIds.length;
        setThemeId(themeIds[nextIndex]);
    }, [themeId, setThemeId]);

    const value = useMemo(() => ({
        themeId, theme, themes: themeList, setThemeId, cycleTheme, hasGlow, hasGrain, hasGlassmorphism,
    }), [themeId, theme, setThemeId, cycleTheme, hasGlow, hasGrain, hasGlassmorphism]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}

export default ThemeContext;
