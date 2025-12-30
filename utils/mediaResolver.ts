/**
 * Media Resolver Utility
 * Handles resolution of persistent media (IndexedDB) to Blob URLs.
 * Shared by TimelinePreview and VideoExportService.
 */

const DB_NAME = 'StudioJenialMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

// Keep track of created object URLs to revoke them if needed
const urlCache = new Map<string, string>(); // mediaId -> blobUrl

/**
 * Open IndexedDB connection
 */
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

/**
 * Get a Blob from IndexedDB by Media ID
 */
export const getMediaBlob = async (mediaId: string): Promise<Blob | null> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(mediaId);

            request.onsuccess = () => {
                if (request.result && request.result.blob) {
                    resolve(request.result.blob);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('[MediaResolver] Failed to get blob:', error);
        return null;
    }
};

/**
 * Get an Object URL for a Media ID.
 * Returns cached URL if available, otherwise creates new one.
 */
export const getMediaUrl = async (mediaId: string): Promise<string | null> => {
    if (urlCache.has(mediaId)) {
        return urlCache.get(mediaId)!;
    }

    const blob = await getMediaBlob(mediaId);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    urlCache.set(mediaId, url);
    return url;
};

/**
 * Revoke a cached URL
 */
export const revokeMediaUrl = (mediaId: string) => {
    if (urlCache.has(mediaId)) {
        URL.revokeObjectURL(urlCache.get(mediaId)!);
        urlCache.delete(mediaId);
    }
};

/**
 * Revoke all cached URLs
 */
export const revokeAllMediaUrls = () => {
    urlCache.forEach(url => URL.revokeObjectURL(url));
    urlCache.clear();
};
