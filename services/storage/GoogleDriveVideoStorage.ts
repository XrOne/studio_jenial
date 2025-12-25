import { StorageProvider, VideoStorageProvider, UploadResult, UploadOptions } from '../VideoStorageProvider';
import { supabase } from '../supabaseClient'; // Usage of supabase helper for auth check, not storage
import { isDriveConnected } from '../googleDriveClient';

export class GoogleDriveVideoStorage implements VideoStorageProvider {
    readonly name = StorageProvider.GOOGLE_DRIVE;

    async isAvailable(): Promise<boolean> {
        // Check if user has connected Google Drive
        return await isDriveConnected();
    }

    async upload(
        blob: Blob,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        console.log(`[DriveStorage] Starting upload for ${filename} (${blob.size} bytes)`);

        try {
            // 1. Get Authentication Token
            const session = await supabase?.auth.getSession();
            const token = session?.data.session?.access_token;
            if (!token) throw new Error('User not authenticated');

            // 2. Initialize Resumable Upload
            const initRes = await fetch('/api/google/drive/init-upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fileName: filename,
                    mimeType: options?.contentType || 'video/mp4'
                })
            });

            if (!initRes.ok) {
                const err = await initRes.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to init upload');
            }

            const { uploadUrl } = await initRes.json();
            if (!uploadUrl) throw new Error('No upload URL received');

            // 3. Upload File Directly to Drive (PUT)
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': options?.contentType || 'video/mp4',
                    'Content-Length': blob.size.toString()
                },
                body: blob
            });

            if (!uploadRes.ok) {
                throw new Error(`Drive upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
            }

            const driveFile = await uploadRes.json();

            // 4. Construct Result
            // Note: webViewLink might need to be fetched separately if not returned by PUT
            // usually PUT to uploadUrl returns the file object.

            return {
                publicUrl: driveFile.webViewLink, // This is a view link, not a direct public URL usually
                provider: this.name,
                path: driveFile.id,
                size: blob.size,
                uploadedAt: new Date(),
                providerMetadata: {
                    fileId: driveFile.id,
                    driveLink: driveFile.webViewLink,
                    alternateLink: driveFile.alternateLink
                }
            };

        } catch (error) {
            console.error('[DriveStorage] Upload error:', error);
            throw error;
        }
    }

    getPublicUrl(path: string): string {
        // Drive IDs aren't directly public URLs usually, but we can return a view link format?
        // Or assume 'path' is the webViewLink if we stored it? 
        // Logic might need adjustment if we need a direct embed source.
        return `https://drive.google.com/file/d/${path}/view?usp=sharing`;
    }
}
