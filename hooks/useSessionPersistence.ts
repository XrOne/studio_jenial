import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getOrCreateProfile,
    createSession,
    updateSession,
    loadSession,
    listSessions,
    UserProfile,
    StudioSession
} from '../services/sessionService';
import useLocalStorage from './useLocalStorage';

// Auto-save debounce delay (ms)
const AUTO_SAVE_DELAY = 2000;

export interface SessionState {
    currentProfile: UserProfile | null;
    currentSessionId: string | null;
    isAutoSaving: boolean;
    lastSavedAt: Date | null;
}

export const useSessionPersistence = (
    promptSequence: any,
    dogma: any,
    sequenceVideoData: any
) => {
    // Local state
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Persist minimal profile info in localStorage to auto-login
    const [storedProfileId, setStoredProfileId] = useLocalStorage<string>('studio_profile_id', '');
    const [storedProfileName, setStoredProfileName] = useLocalStorage<string>('studio_profile_identifier', '');

    // Debounce ref
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Initializes profile from storage or creates new
     */
    const login = useCallback(async (identifier: string) => {
        try {
            const userProfile = await getOrCreateProfile(identifier);
            setProfile(userProfile);
            setStoredProfileId(userProfile.id);
            setStoredProfileName(userProfile.user_identifier);
            return userProfile;
        } catch (err) {
            console.error('Login failed:', err);
            throw err;
        }
    }, [setStoredProfileId, setStoredProfileName]);

    /**
     * Creates a new session for the current profile
     */
    const startNewSession = useCallback(async (name?: string) => {
        if (!profile) return;
        try {
            const session = await createSession(profile.id, name);
            setSessionId(session.id);
            return session;
        } catch (err) {
            console.error('Failed to start session:', err);
        }
    }, [profile]);

    /**
     * Loads an existing session
     */
    const restoreSession = useCallback(async (sid: string) => {
        try {
            const { session, storyboards } = await loadSession(sid);
            setSessionId(session.id);
            return { session, storyboards };
        } catch (err) {
            console.error('Failed to restore session:', err);
            throw err;
        }
    }, []);

    /**
     * Auto-Login on mount if stored profile exists
     */
    useEffect(() => {
        if (storedProfileName && !profile) {
            login(storedProfileName).catch(console.warn);
        }
    }, [storedProfileName, login, profile]);

    /**
     * Auto-Save Effect
     * Triggers when monitored data (prompts, dogma, videos) changes
     */
    useEffect(() => {
        if (!sessionId || !promptSequence) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Only save if we have actual data
        if (!promptSequence.mainPrompt) return;

        saveTimeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await updateSession(sessionId, {
                    main_prompt: promptSequence.mainPrompt || '',
                    extension_prompts: promptSequence.extensionPrompts || [],
                    active_prompt_index: 0, // Should be passed as prop if we want to persist cursor
                    sequence_video_data: sequenceVideoData,
                    // Simplify dogma for storage (or full snapshot)
                    dogma_id: dogma?.id,
                    dogma_snapshot: dogma
                });
                setLastSaved(new Date());
            } catch (err) {
                console.error('Auto-save error:', err);
            } finally {
                setIsSaving(false);
            }
        }, AUTO_SAVE_DELAY);

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, [sessionId, promptSequence, dogma, sequenceVideoData]);

    return {
        profile,
        sessionId,
        isSaving,
        lastSaved,
        login,
        startNewSession,
        restoreSession,
        listHistory: useCallback(() => profile ? listSessions(profile.id) : Promise.resolve([]), [profile])
    };
};
