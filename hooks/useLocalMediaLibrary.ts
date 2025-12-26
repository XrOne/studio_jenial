/**
 * useLocalMediaLibrary Hook
 * Manages local rushes/media with IndexedDB persistence for large files
 * and localStorage for metadata
 */

import { useState, useEffect, useCallback } from 'react';
import { RushMedia, MediaUploadResult, LocalMediaLibraryState } from '../types/media';

const MEDIA_METADATA_KEY = 'studio_jenial_media_metadata';
const DB_NAME = 'StudioJenialMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

// Generate unique ID
const generateId = () => `rush_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Open IndexedDB
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// Generate video thumbnail
const generateVideoThumbnail = (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoBlob);
        video.src = url;

        video.onloadeddata = () => {
            video.currentTime = Math.min(1, video.duration / 4); // Go to 25% or 1s
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(url);
                resolve(thumbnail);
            } else {
                URL.revokeObjectURL(url);
                reject(new Error('Canvas context unavailable'));
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video'));
        };
    });
};

// Generate image thumbnail
const generateImageThumbnail = (imageBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(imageBlob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Center crop
                const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width - img.width * scale) / 2;
                const y = (canvas.height - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(url);
                resolve(thumbnail);
            } else {
                URL.revokeObjectURL(url);
                reject(new Error('Canvas context unavailable'));
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
};

// Get video duration
const getVideoDuration = (videoBlob: Blob): Promise<number> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(videoBlob);
        video.src = url;

        video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0);
        };
    });
};

export const useLocalMediaLibrary = () => {
    const [state, setState] = useState<LocalMediaLibraryState>({
        rushes: [],
        generated: [],
        isLoading: true
    });

    // Load metadata from localStorage on mount
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const stored = localStorage.getItem(MEDIA_METADATA_KEY);
                if (stored) {
                    const metadata = JSON.parse(stored) as { rushes: RushMedia[], generated: RushMedia[] };

                    // Recreate object URLs from IndexedDB
                    const db = await openDB();

                    const recreateUrls = async (items: RushMedia[]): Promise<RushMedia[]> => {
                        return Promise.all(items.map(async (item) => {
                            try {
                                const blob = await new Promise<Blob>((resolve, reject) => {
                                    const tx = db.transaction(STORE_NAME, 'readonly');
                                    const store = tx.objectStore(STORE_NAME);
                                    const request = store.get(item.id);
                                    request.onsuccess = () => {
                                        if (request.result) {
                                            resolve(request.result.blob);
                                        } else {
                                            reject(new Error('Not found'));
                                        }
                                    };
                                    request.onerror = () => reject(request.error);
                                });
                                return { ...item, localUrl: URL.createObjectURL(blob) };
                            } catch {
                                return item; // Keep stale URL if blob not found
                            }
                        }));
                    };

                    const rushes = await recreateUrls(metadata.rushes);
                    const generated = await recreateUrls(metadata.generated);

                    setState({ rushes, generated, isLoading: false });
                } else {
                    setState(s => ({ ...s, isLoading: false }));
                }
            } catch (error) {
                console.error('[MediaLibrary] Failed to load:', error);
                setState(s => ({ ...s, isLoading: false }));
            }
        };

        loadMetadata();
    }, []);

    // Save metadata to localStorage whenever state changes
    useEffect(() => {
        if (!state.isLoading) {
            // Don't store localUrl (it's a blob URL, not persistent)
            const toStore = {
                rushes: state.rushes.map(r => ({ ...r, localUrl: '' })),
                generated: state.generated.map(r => ({ ...r, localUrl: '' }))
            };
            localStorage.setItem(MEDIA_METADATA_KEY, JSON.stringify(toStore));
        }
    }, [state.rushes, state.generated, state.isLoading]);

    // Upload a file
    const uploadMedia = useCallback(async (file: File, category: 'rushes' | 'generated' = 'rushes'): Promise<MediaUploadResult> => {
        try {
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');

            if (!isVideo && !isImage) {
                return { success: false, error: 'Unsupported file type. Please upload video or image files.' };
            }

            const id = generateId();
            const blob = file;

            // Store blob in IndexedDB
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.put({ id, blob });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            // Generate thumbnail
            const thumbnail = isVideo
                ? await generateVideoThumbnail(blob)
                : await generateImageThumbnail(blob);

            // Get duration for videos
            const durationSec = isVideo ? await getVideoDuration(blob) : undefined;

            const media: RushMedia = {
                id,
                name: file.name,
                type: isVideo ? 'video' : 'image',
                localUrl: URL.createObjectURL(blob),
                thumbnail,
                durationSec,
                sizeBytes: file.size,
                mimeType: file.type,
                createdAt: Date.now()
            };

            setState(s => ({
                ...s,
                [category]: [...s[category], media]
            }));

            console.log(`[MediaLibrary] Uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            return { success: true, media };

        } catch (error) {
            console.error('[MediaLibrary] Upload failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
        }
    }, []);

    // Delete media
    const deleteMedia = useCallback(async (id: string, category: 'rushes' | 'generated' = 'rushes') => {
        try {
            // Remove from IndexedDB
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            // Revoke object URL
            const item = state[category].find(m => m.id === id);
            if (item?.localUrl) {
                URL.revokeObjectURL(item.localUrl);
            }

            // Remove from state
            setState(s => ({
                ...s,
                [category]: s[category].filter(m => m.id !== id)
            }));

            console.log(`[MediaLibrary] Deleted: ${id}`);
        } catch (error) {
            console.error('[MediaLibrary] Delete failed:', error);
        }
    }, [state]);

    // Rename media
    const renameMedia = useCallback((id: string, newName: string, category: 'rushes' | 'generated' = 'rushes') => {
        setState(s => ({
            ...s,
            [category]: s[category].map(m => m.id === id ? { ...m, name: newName } : m)
        }));
    }, []);

    // Clear all media
    const clearAll = useCallback(async () => {
        try {
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            // Revoke all URLs
            [...state.rushes, ...state.generated].forEach(m => {
                if (m.localUrl) URL.revokeObjectURL(m.localUrl);
            });

            setState({ rushes: [], generated: [], isLoading: false });
            localStorage.removeItem(MEDIA_METADATA_KEY);
        } catch (error) {
            console.error('[MediaLibrary] Clear failed:', error);
        }
    }, [state]);

    return {
        rushes: state.rushes,
        generated: state.generated,
        isLoading: state.isLoading,
        uploadMedia,
        deleteMedia,
        renameMedia,
        clearAll
    };
};
