/**
 * Local Media Database using IndexedDB (via Dexie)
 * Stores full-quality videos and proxies for offline/local-first workflow
 */

import Dexie, { Table } from 'dexie';
import { LocalShot, LocalMediaAsset } from '../types/project';

// Database schema
class LocalMediaDatabase extends Dexie {
    shots!: Table<LocalShot, string>;
    assets!: Table<LocalMediaAsset, string>;

    constructor() {
        super('StudioJenialDB');

        this.version(1).stores({
            shots: 'id, projectId, createdAt',
            assets: 'id, projectId, filename, createdAt',
        });
    }
}

const db = new LocalMediaDatabase();

// === SHOTS API ===

export async function saveShot(shot: LocalShot): Promise<void> {
    await db.shots.put(shot);
    console.log(`[LocalMediaDB] Saved shot: ${shot.id}`);
}

export async function getShot(id: string): Promise<LocalShot | undefined> {
    return db.shots.get(id);
}

export async function getShotsByProject(projectId: string): Promise<LocalShot[]> {
    return db.shots.where('projectId').equals(projectId).toArray();
}

export async function deleteShot(id: string): Promise<void> {
    await db.shots.delete(id);
}

// === ASSETS API ===

export async function saveAsset(asset: LocalMediaAsset): Promise<void> {
    await db.assets.put(asset);
    console.log(`[LocalMediaDB] Saved asset: ${asset.filename}`);
}

export async function getAsset(id: string): Promise<LocalMediaAsset | undefined> {
    return db.assets.get(id);
}

export async function getAssetsByProject(projectId: string): Promise<LocalMediaAsset[]> {
    return db.assets.where('projectId').equals(projectId).toArray();
}

export async function deleteAsset(id: string): Promise<void> {
    await db.assets.delete(id);
}

// === UTILITY ===

export async function clearProjectData(projectId: string): Promise<void> {
    await db.shots.where('projectId').equals(projectId).delete();
    await db.assets.where('projectId').equals(projectId).delete();
}

export async function getDatabaseSize(): Promise<{ shots: number; assets: number }> {
    const shotsCount = await db.shots.count();
    const assetsCount = await db.assets.count();
    return { shots: shotsCount, assets: assetsCount };
}

// === BLOB HELPERS ===

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

export { db };
