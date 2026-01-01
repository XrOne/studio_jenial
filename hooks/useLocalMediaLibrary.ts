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

// Polyfill for VideoFrameMetadata
interface VideoFrameMetadata {
    presentationTime: number;
    expectedDisplayTime: number;
    width: number;
    height: number;
    mediaTime: number;
    presentedFrames: number;
    processingDuration?: number;
    captureTime?: number;
    receiveTime?: number;
    rtpTimestamp?: number;
}

// Generate video thumbnail
// Unified Video Processor with FPS Detection
const processVideoImport = (videoBlob: Blob): Promise<{
    thumbnail: string;
    durationSec: number;
    metadata: { width: number; height: number; fps: number; totalFrames: number; isVFR: boolean; };
}> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto'; // Load data for playback
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoBlob);
        video.src = url;

        // Metadata loaded: Get dimensions and duration
        video.onloadedmetadata = () => {
            // Wait for data to be ready
            video.currentTime = 0;
        };

        let frameCount = 0;
        let startTime = 0;
        let videoCallbackId: number;

        const countFrames = (now: number, metadata: VideoFrameMetadata) => {
            if (startTime === 0) startTime = now;
            frameCount++;

            const elapsed = now - startTime;

            // Measure for 500ms (enough to distinguish 24/25/30/60)
            if (elapsed < 500) {
                videoCallbackId = video.requestVideoFrameCallback(countFrames);
            } else {
                // Done measuring
                video.pause();

                // Calculate FPS
                const rawFps = (frameCount / elapsed) * 1000;
                // Snap to common frame rates
                const commonRates = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
                const fps = commonRates.reduce((prev, curr) =>
                    Math.abs(curr - rawFps) < Math.abs(prev - rawFps) ? curr : prev
                );

                // Check VFR (if rawFps deviates significantly from snapped)
                // Note: strict VFR detection requires full scan, this is a heuristic
                const isVFR = Math.abs(rawFps - fps) > 0.5;

                const durationSec = video.duration || 0;
                const totalFrames = Math.round(durationSec * fps);
                const width = video.videoWidth;
                const height = video.videoHeight;

                // Generate Thumbnail (we are likely at ~0.5s or just seek to 25%)
                video.currentTime = Math.min(1, durationSec / 4);

                // Wait for seek before capturing thumbnail
                const onSeeked = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 320;
                    canvas.height = 180;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);

                        URL.revokeObjectURL(url);
                        resolve({
                            thumbnail,
                            durationSec,
                            metadata: { width, height, fps, totalFrames, isVFR }
                        });
                    } else {
                        URL.revokeObjectURL(url);
                        // Fallback
                        resolve({ thumbnail: '', durationSec, metadata: { width, height, fps, totalFrames, isVFR } });
                    }
                };

                // We need to wait for seek to complete
                // Since we were playing, pause() was called.
                // triggering seek
                video.onseeked = onSeeked;
            }
        };

        video.oncanplay = () => {
            // Start measurement loop
            startTime = 0;
            frameCount = 0;
            video.play().then(() => {
                if ('requestVideoFrameCallback' in video) {
                    videoCallbackId = video.requestVideoFrameCallback(countFrames);
                } else {
                    // Fallback for browsers without rVFC (should be rare now)
                    // Just assume 25fps
                    console.warn('requestVideoFrameCallback not supported, defaulting to 25fps');
                    video.pause();
                    video.currentTime = Math.min(1, video.duration / 4);
                    video.onseeked = () => {
                        // ... same thumbnail logic ...
                        // Simplified fallback
                        const canvas = document.createElement('canvas');
                        canvas.width = 320;
                        canvas.height = 180;
                        const ctx = canvas.getContext('2d');
                        const thumbnail = ctx ? (ctx.drawImage(video, 0, 0, 320, 180), canvas.toDataURL('image/jpeg', 0.7)) : '';
                        URL.revokeObjectURL(url);
                        resolve({ thumbnail, durationSec: video.duration, metadata: { width: video.videoWidth, height: video.videoHeight, fps: 25, totalFrames: Math.round(video.duration * 25), isVFR: false } });
                    }
                }
            }).catch(e => {
                URL.revokeObjectURL(url);
                reject(e);
            });
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

            // Process media
            let thumbnail = '';
            let durationSec = undefined;
            let metadata = undefined;

            if (isVideo) {
                const result = await processVideoImport(blob);
                thumbnail = result.thumbnail;
                durationSec = result.durationSec;
                metadata = result.metadata;
            } else {
                thumbnail = await generateImageThumbnail(blob);
            }

            const media: RushMedia = {
                id,
                name: file.name,
                type: isVideo ? 'video' : 'image',
                localUrl: URL.createObjectURL(blob),
                thumbnail,
                durationSec,
                sizeBytes: file.size,
                mimeType: file.type,
                createdAt: Date.now(),
                metadata
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
