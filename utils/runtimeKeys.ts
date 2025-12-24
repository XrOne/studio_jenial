/**
 * Runtime Keys Utility (Preview MVP)
 * 
 * Manages API keys for the preview environment.
 * Uses localStorage/sessionStorage only when VERCEL_ENV is 'preview'.
 * STRICT BYOK: In production, never writes to storage.
 */

const isPreview = import.meta.env.VITE_VERCEL_ENV === 'preview' || window.location.hostname.includes('vercel.app');

export const setGeminiKey = (key: string) => {
    if (!isPreview) {
        console.log('[RuntimeKeys] Prod mode: Ignoring storage write');
        return;
    }
    if (!key) return;

    localStorage.setItem('gemini_api_key', key);
    sessionStorage.setItem('gemini_api_key', key);
    console.log('[RuntimeKeys] Key saved to storage (Preview Only)');
};

export const getGeminiKey = (): string | null => {
    if (!isPreview) return null;
    return localStorage.getItem('gemini_api_key') || sessionStorage.getItem('gemini_api_key');
};

export const clearGeminiKey = () => {
    if (!isPreview) return;
    localStorage.removeItem('gemini_api_key');
    sessionStorage.removeItem('gemini_api_key');
    console.log('[RuntimeKeys] Key cleared from storage');
};

export const hasGeminiKey = (): boolean => {
    return !!getGeminiKey();
};
