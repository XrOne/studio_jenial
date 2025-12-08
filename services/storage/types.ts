/**
 * Video Storage Provider Abstraction
 */

export enum StorageProvider {
    SUPABASE = 'supabase',
    GOOGLE_CLOUD_STORAGE = 'gcs',
    GOOGLE_DRIVE = 'drive',
    LOCAL_BLOB = 'local'
}

export interface UploadOptions {
    /**
     * MIME type of the file (default: 'video/mp4')
     */
    contentType?: string;

    /**
     * Cache-Control header value (default: '3600')
     */
    cacheControl?: string;

    /**
     * Custom metadata to attach to the file
     */
    metadata?: Record<string, string>;

    /**
     * Whether to make the file publicly accessible (default: true)
     */
    public?: boolean;
}

export interface UploadResult {
    /**
     * Public URL to access the uploaded file
     */
    publicUrl: string;

    /**
     * Provider that handled the upload
     */
    provider: StorageProvider;

    /**
     * Internal path/key in the storage system
     */
    path: string;

    /**
     * Size of the uploaded file in bytes
     */
    size?: number;

    /**
     * Timestamp when the upload completed
     */
    uploadedAt: Date;

    /**
     * Provider-specific metadata
     */
    providerMetadata?: Record<string, any>;
}

export interface VideoStorageProvider {
    /**
     * Unique identifier for this provider
     */
    readonly name: StorageProvider;

    /**
     * Check if this provider is configured and available
     */
    isAvailable(): Promise<boolean>;

    /**
     * Upload a video to storage
     * Supports Buffer, Blob/File, or Stream (depending on env)
     */
    upload(
        file: Buffer | Blob | ArrayBuffer,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult>;

    /**
     * Get the public URL for an already-uploaded file
     */
    getPublicUrl(path: string): string;
}
