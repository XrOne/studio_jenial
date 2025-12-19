import { useState, useCallback } from 'react';
import { Project, ProjectState, PromptSequence, StoryboardPreview, SequenceVideoData, Dogma, ImageFile, VideoFile, Character } from '../types';
import { ProjectService } from '../services/projectService';

export const useProjectPersistence = (
    user: any,
    state: {
        promptSequence: PromptSequence | null;
        storyboardByIndex: Record<number, StoryboardPreview>;
        sequenceVideoData: Record<number, SequenceVideoData>;
        activeDogma: Dogma | null;
        assistantMotionDescription: string | null;
        assistantExtensionContext: ImageFile | null;
        assistantImage: ImageFile | null;
        assistantReferenceVideo: VideoFile | null;
        mentionedCharacters: Character[];
    },
    setters: {
        setPromptSequence: (p: PromptSequence | null) => void;
        setStoryboardByIndex: (s: Record<number, StoryboardPreview>) => void;
        setSequenceVideoData: (v: Record<number, SequenceVideoData>) => void;
        setSequenceBoundDogma: (d: Dogma | null) => void;
        setAssistantMotionDescription: (s: string | null) => void;
        setAssistantExtensionContext: (i: ImageFile | null) => void;
        setAssistantImage: (i: ImageFile | null) => void;
        setAssistantReferenceVideo: (v: VideoFile | null) => void;
        setMentionedCharacters: (c: Character[]) => void;
    }
) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Helper to sanitize ImageFile (remove File object, keep base64)
    const sanitizeImage = useCallback((img: ImageFile | null): ImageFile | null => {
        if (!img) return null;
        // If base64 exists, use it. If not, and file exists, we can't sync it easily. 
        // Assuming base64 is populated.
        return { base64: img.base64, file: null as any };
    }, []);

    // Helper to sanitize VideoFile
    const sanitizeVideo = useCallback((vid: VideoFile | null): VideoFile | null => {
        if (!vid) return null;
        return { base64: vid.base64, file: null as any };
    }, []);

    const serializeState = useCallback((): ProjectState => {
        // Sanitize Storyboard
        const sanitizedStoryboard: Record<number, StoryboardPreview> = {};
        Object.entries(state.storyboardByIndex).forEach(([k, v]) => {
            sanitizedStoryboard[Number(k)] = {
                ...v,
                baseImage: sanitizeImage(v.baseImage || null) || undefined,
                previewImage: sanitizeImage(v.previewImage)!, // previewImage is required
            };
        });

        // Sanitize Sequence Video Data (Persist thumbnail, drop blob)
        // We cannot persist Blobs in JSON. 
        // Ideally we upload to storage and store URL. 
        // For now, we store the thumbnail and accept that video component will need regeneration or won't play.
        // Or we store ONLY properties that are strings.
        const sanitizedVideoData: Record<number, SequenceVideoData> = {};
        Object.entries(state.sequenceVideoData).forEach(([k, v]) => {
            sanitizedVideoData[Number(k)] = {
                ...v,
                blob: null as any, // Cannot persist
                video: null as any, // Cannot persist
                // Keep url if it's external? If it's blob:..., it's useless after reload.
                url: v.url.startsWith('blob:') ? '' : v.url
            };
        });

        return {
            promptSequence: state.promptSequence,
            storyboardByIndex: sanitizedStoryboard,
            sequenceVideoData: sanitizedVideoData,
            sequenceHistory: [], // Deprecated
            activeDogma: state.activeDogma ? { ...state.activeDogma, referenceImages: state.activeDogma.referenceImages.map(img => ({ ...img })) } : null,
            assistants: {
                motionDescription: state.assistantMotionDescription,
                assistantExtensionContext: sanitizeImage(state.assistantExtensionContext),
                assistantImage: sanitizeImage(state.assistantImage),
                assistantReferenceVideo: sanitizeVideo(state.assistantReferenceVideo),
                mentionedCharacters: state.mentionedCharacters
            }
        };
    }, [state, sanitizeImage, sanitizeVideo]);

    const loadState = useCallback((params: ProjectState) => {
        if (!params) return;
        setters.setPromptSequence(params.promptSequence);
        setters.setStoryboardByIndex(params.storyboardByIndex || {});
        setters.setSequenceVideoData(params.sequenceVideoData || {});
        setters.setSequenceBoundDogma(params.activeDogma || null);

        // Assistants
        setters.setAssistantMotionDescription(params.assistants?.motionDescription || null);
        setters.setAssistantExtensionContext(params.assistants?.assistantExtensionContext || null);
        setters.setAssistantImage(params.assistants?.assistantImage || null);
        setters.setAssistantReferenceVideo(params.assistants?.assistantReferenceVideo || null);
        setters.setMentionedCharacters(params.assistants?.mentionedCharacters || []);

        // Note: Video pointers (blobs) are lost. UI should handle missing videos gracefully.
    }, [setters]);

    const saveProject = async () => {
        if (!user) {
            alert('Please sign in to save projects');
            return;
        }

        let projectToSave = currentProject;

        if (!projectToSave) {
            const title = prompt('Enter project title:', 'My Jenial Movie');
            if (!title) return;
            try {
                projectToSave = await ProjectService.createProject(user.id, title);
                setCurrentProject(projectToSave);
            } catch (e) {
                console.error('Failed to create project', e);
                alert('Failed to create project');
                return;
            }
        }

        setIsSaving(true);
        try {
            const stateData = serializeState();
            await (ProjectService.saveProject(projectToSave.id, stateData));
            // Alert handled by UI if needed
        } catch (e) {
            console.error('Failed to save project', e);
            alert('Failed to save project');
        } finally {
            setIsSaving(false);
        }
    };

    const loadProject = (project: Project) => {
        setCurrentProject(project);
        if (project.content_json) {
            loadState(project.content_json);
        }
    };

    return {
        currentProject,
        setCurrentProject,
        saveProject,
        loadProject,
        isSaving
    };
};
