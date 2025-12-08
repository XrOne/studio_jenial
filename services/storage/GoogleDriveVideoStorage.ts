import {
    StorageProvider,
    VideoStorageProvider,
    UploadResult,
    UploadOptions
} from '../VideoStorageProvider';

/**
 * Google Drive implementation of VideoStorageProvider
 * 
 * TODO: Implement using Google Drive API (via shared backend client or simple export)
 */
export class GoogleDriveVideoStorage implements VideoStorageProvider {
    readonly name = StorageProvider.GOOGLE_DRIVE;

    async isAvailable(): Promise<boolean> {
        // Check if user has connected Drive
        // return await isDriveConnected();
        return false; // Not implemented as primary storage yet
    }

    async upload(
        blob: Blob,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        // This would use the existing googleDriveService to upload
        // and set permissions to 'anyone with link' if public=true
        throw new Error('Google Drive primary storage not implemented yet');
    }

    getPublicUrl(path: string): string {
        // Drive webViewLink or similar
        return '';
    }
}
