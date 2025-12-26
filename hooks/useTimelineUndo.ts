/**
 * useTimelineUndo Hook
 * Provides undo/redo functionality for timeline state
 * 
 * Usage:
 * - Ctrl+Z: Undo
 * - Ctrl+Y or Ctrl+Shift+Z: Redo
 */

import { useCallback, useRef, useState, useEffect } from 'react';

interface UndoStack<T> {
    past: T[];
    present: T;
    future: T[];
}

interface UseTimelineUndoOptions {
    maxHistory?: number;
}

export function useTimelineUndo<T>(
    initialState: T,
    options: UseTimelineUndoOptions = {}
) {
    const { maxHistory = 50 } = options;

    const [state, setState] = useState<UndoStack<T>>({
        past: [],
        present: initialState,
        future: []
    });

    const skipNextRef = useRef(false);

    // Update present (and push to history)
    const set = useCallback((newState: T | ((prev: T) => T)) => {
        setState(prev => {
            const nextState = typeof newState === 'function'
                ? (newState as (prev: T) => T)(prev.present)
                : newState;

            // Don't push to history if state hasn't changed
            if (JSON.stringify(prev.present) === JSON.stringify(nextState)) {
                return prev;
            }

            // Skip history if flagged (for undo/redo operations)
            if (skipNextRef.current) {
                skipNextRef.current = false;
                return { ...prev, present: nextState };
            }

            const newPast = [...prev.past, prev.present].slice(-maxHistory);
            return {
                past: newPast,
                present: nextState,
                future: [] // Clear future on new action
            };
        });
    }, [maxHistory]);

    // Undo action
    const undo = useCallback(() => {
        setState(prev => {
            if (prev.past.length === 0) return prev;

            const newPast = prev.past.slice(0, -1);
            const previousState = prev.past[prev.past.length - 1];

            return {
                past: newPast,
                present: previousState,
                future: [prev.present, ...prev.future]
            };
        });
    }, []);

    // Redo action
    const redo = useCallback(() => {
        setState(prev => {
            if (prev.future.length === 0) return prev;

            const [nextState, ...restFuture] = prev.future;

            return {
                past: [...prev.past, prev.present],
                present: nextState,
                future: restFuture
            };
        });
    }, []);

    // Clear history
    const clearHistory = useCallback(() => {
        setState(prev => ({
            past: [],
            present: prev.present,
            future: []
        }));
    }, []);

    // Keyboard handler for Ctrl+Z / Ctrl+Y
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    // Ctrl+Shift+Z = Redo
                    e.preventDefault();
                    redo();
                } else {
                    // Ctrl+Z = Undo
                    e.preventDefault();
                    undo();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                // Ctrl+Y = Redo
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return {
        state: state.present,
        set,
        undo,
        redo,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0,
        historyLength: state.past.length,
        clearHistory
    };
}

export default useTimelineUndo;
