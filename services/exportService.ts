import { ProjectState } from '../types';

/**
 * Export/Import service for local JSON backup of project state.
 * Provides a fallback when Supabase is unavailable or user prefers local storage.
 */

/**
 * Export project state to a downloadable JSON file.
 */
export function exportProjectToJSON(state: ProjectState, projectTitle: string = 'project'): void {
    try {
        // Create a clean, serializable copy
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            title: projectTitle,
            state: state
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[Export] Project exported successfully');
    } catch (error) {
        console.error('[Export] Failed to export project:', error);
        throw new Error('Failed to export project');
    }
}

/**
 * Import project state from a JSON file.
 * Returns the parsed ProjectState or throws on error.
 */
export async function importProjectFromJSON(file: File): Promise<{ title: string; state: ProjectState }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);

                // Validate structure
                if (!parsed.state) {
                    throw new Error('Invalid project file: missing state');
                }

                // Basic validation of required fields
                if (parsed.state.promptSequence === undefined) {
                    throw new Error('Invalid project file: missing promptSequence');
                }

                console.log('[Import] Project imported successfully:', parsed.title);
                resolve({
                    title: parsed.title || 'Imported Project',
                    state: parsed.state as ProjectState
                });
            } catch (error) {
                console.error('[Import] Failed to parse project file:', error);
                reject(new Error('Invalid project file format'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Trigger file picker for import
 */
export function triggerImportFilePicker(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            resolve(file || null);
        };

        input.click();
    });
}
