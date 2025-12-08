import {
    StorageProvider,
    VideoStorageProvider,
    UploadResult,
    UploadOptions
} from '../VideoStorageProvider';

/**
 * Google Cloud Storage implementation of VideoStorageProvider
 * 
 * TODO: Fully implement using @google-cloud/storage or Signed URLs
 */
export class GCSVideoStorage implements VideoStorageProvider {
    readonly name = StorageProvider.GOOGLE_CLOUD_STORAGE;
    private bucketName: string;

    constructor(bucketName: string) {
        this.bucketName = bucketName;
    }

    async isAvailable(): Promise<boolean> {
        // Check if GCS credentials/config are present
        // const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
        // return hasCreds;
        return false; // Not implemented yet
    }

    async upload(
        blob: Blob,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        console.warn('GCS upload not implemented. Using stub.');

        // TODO: Implement GCS upload
        // 1. Get Signed URL from backend (secure way)
        // 2. PUT blob to Signed URL

        throw new Error('GCS upload not implemented yet');
    }

    getPublicUrl(path: string): string {
        return `https://storage.googleapis.com/${this.bucketName}/${path}`;
    }
}
