/**
 * Studio Jenial - Design Tokens
 * 3 Skins: Terminal Pro | Cinematic Studio | Néon Studio
 */

export type ThemeId = 'terminal' | 'cinematic' | 'neon';

export interface ThemeTokens {
    id: ThemeId;
    name: string;
    subtitle: string;
    colors: {
        bg: string;
        bgAlt: string;
        surface: string;
        surfaceHover: string;
        surfaceActive: string;
        border: string;
        borderHover: string;
        borderActive: string;
        accent: string;
        accentHover: string;
        accentMuted: string;
        accentGlow?: string;
        text: string;
        textMuted: string;
        textAccent: string;
        success: string;
        warning: string;
        error: string;
        info: string;
        trackVideo: string;
        trackAudio: string;
        trackVideoActive: string;
        trackAudioActive: string;
    };
    fonts: {
        body: string;
        heading: string;
        mono: string;
    };
    radius: {
        none: string;
        sm: string;
        md: string;
        lg: string;
        full: string;
    };
    effects: {
        glow: boolean;
        grain: boolean;
        glassmorphism: boolean;
    };
    shadows: {
        sm: string;
        md: string;
        lg: string;
        accent: string;
    };
}

// TERMINAL PRO
export const terminalTheme: ThemeTokens = {
    id: 'terminal',
    name: 'Terminal Pro',
    subtitle: 'Bloomberg × DaVinci',
    colors: {
        bg: '#000000',
        bgAlt: '#050505',
        surface: '#0a0a0a',
        surfaceHover: '#111111',
        surfaceActive: '#1a1a1a',
        border: '#1a1a1a',
        borderHover: '#2a2a2a',
        borderActive: '#00ff41',
        accent: '#00ff41',
        accentHover: '#00cc33',
        accentMuted: 'rgba(0, 255, 65, 0.12)',
        text: '#e0e0e0',
        textMuted: '#666666',
        textAccent: '#00ff41',
        success: '#00ff41',
        warning: '#ffaa00',
        error: '#ff3333',
        info: '#00aaff',
        trackVideo: '#003300',
        trackAudio: '#002200',
        trackVideoActive: '#004400',
        trackAudioActive: '#003300',
    },
    fonts: {
        body: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        heading: "'JetBrains Mono', 'Fira Code', monospace",
        mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    },
    radius: { none: '0px', sm: '0px', md: '0px', lg: '0px', full: '0px' },
    effects: { glow: false, grain: false, glassmorphism: false },
    shadows: {
        sm: 'none',
        md: '0 2px 8px rgba(0, 0, 0, 0.5)',
        lg: '0 4px 16px rgba(0, 0, 0, 0.6)',
        accent: '0 0 20px rgba(0, 255, 65, 0.3)',
    },
};

// CINEMATIC STUDIO
export const cinematicTheme: ThemeTokens = {
    id: 'cinematic',
    name: 'Cinematic Studio',
    subtitle: 'ARRI × Panavision',
    colors: {
        bg: '#0d0d0d',
        bgAlt: '#0a0a0a',
        surface: '#161616',
        surfaceHover: '#1c1c1c',
        surfaceActive: '#222222',
        border: '#2a2a2a',
        borderHover: '#3a3a3a',
        borderActive: '#c9a962',
        accent: '#c9a962',
        accentHover: '#d4b872',
        accentMuted: 'rgba(201, 169, 98, 0.12)',
        text: '#f0f0f0',
        textMuted: '#777777',
        textAccent: '#c9a962',
        success: '#4a9f6e',
        warning: '#c9a962',
        error: '#a65454',
        info: '#5a8fba',
        trackVideo: '#1f1c18',
        trackAudio: '#1a1815',
        trackVideoActive: '#2a2520',
        trackAudioActive: '#252018',
    },
    fonts: {
        body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        heading: "'Georgia', 'Times New Roman', 'Playfair Display', serif",
        mono: "'JetBrains Mono', 'SF Mono', monospace",
    },
    radius: { none: '0px', sm: '2px', md: '3px', lg: '4px', full: '9999px' },
    effects: { glow: false, grain: true, glassmorphism: false },
    shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.6)',
        accent: '0 2px 12px rgba(201, 169, 98, 0.2)',
    },
};

// NÉON STUDIO
export const neonTheme: ThemeTokens = {
    id: 'neon',
    name: 'Néon Studio',
    subtitle: 'Runway × CapCut',
    colors: {
        bg: '#0f0f0f',
        bgAlt: '#0a0a12',
        surface: '#1a1a2e',
        surfaceHover: '#252540',
        surfaceActive: '#2d2d4a',
        border: '#2d2d4a',
        borderHover: '#3d3d5a',
        borderActive: '#a855f7',
        accent: '#a855f7',
        accentHover: '#b866ff',
        accentMuted: 'rgba(168, 85, 247, 0.15)',
        accentGlow: 'rgba(168, 85, 247, 0.4)',
        text: '#ffffff',
        textMuted: '#8888aa',
        textAccent: '#a855f7',
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444',
        info: '#06b6d4',
        trackVideo: '#1e1e3f',
        trackAudio: '#1a1a35',
        trackVideoActive: '#2a2a55',
        trackAudioActive: '#252550',
    },
    fonts: {
        body: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
        heading: "'Space Grotesk', 'Inter', sans-serif",
        mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
    radius: { none: '0px', sm: '6px', md: '10px', lg: '14px', full: '9999px' },
    effects: { glow: true, grain: false, glassmorphism: true },
    shadows: {
        sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
        md: '0 4px 16px rgba(0, 0, 0, 0.4)',
        lg: '0 8px 32px rgba(0, 0, 0, 0.5)',
        accent: '0 4px 20px rgba(168, 85, 247, 0.4)',
    },
};

// REGISTRY
export const themes: Record<ThemeId, ThemeTokens> = {
    terminal: terminalTheme,
    cinematic: cinematicTheme,
    neon: neonTheme,
};

export const themeList = Object.values(themes);
export const defaultThemeId: ThemeId = 'cinematic';

export function generateCSSVariables(theme: ThemeTokens): Record<string, string> {
    return {
        '--color-bg': theme.colors.bg,
        '--color-bg-alt': theme.colors.bgAlt,
        '--color-surface': theme.colors.surface,
        '--color-surface-hover': theme.colors.surfaceHover,
        '--color-surface-active': theme.colors.surfaceActive,
        '--color-border': theme.colors.border,
        '--color-border-hover': theme.colors.borderHover,
        '--color-border-active': theme.colors.borderActive,
        '--color-accent': theme.colors.accent,
        '--color-accent-hover': theme.colors.accentHover,
        '--color-accent-muted': theme.colors.accentMuted,
        '--color-text': theme.colors.text,
        '--color-text-muted': theme.colors.textMuted,
        '--color-text-accent': theme.colors.textAccent,
        '--font-body': theme.fonts.body,
        '--font-heading': theme.fonts.heading,
        '--font-mono': theme.fonts.mono,
        '--radius-none': theme.radius.none,
        '--radius-sm': theme.radius.sm,
        '--radius-md': theme.radius.md,
        '--radius-lg': theme.radius.lg,
        '--radius-full': theme.radius.full,
        '--shadow-sm': theme.shadows.sm,
        '--shadow-md': theme.shadows.md,
        '--shadow-lg': theme.shadows.lg,
        '--shadow-accent': theme.shadows.accent,
    };
}
