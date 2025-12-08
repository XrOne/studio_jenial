/**
 * Video Storage Provider Abstraction
 * 
 * This interface allows Studio Jenial to support multiple storage backends
 * (Supabase, Google Cloud Storage, Google Drive, etc.) without changing
 * the core video generation logic.
 */

export enum StorageProvider {
    SUPABASE = 'supabase',
    GOOGLE_CLOUD_STORAGE = 'gcs',
    GOOGLE_DRIVE = 'drive',
    LOCAL_BLOB = 'local',
    CLOUDFLARE_R2 = 'r2',
    AWS_S3 = 's3'
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

    /**
     * Progress callback for large uploads
     */
    onProgress?: (bytesUploaded: number, totalBytes: number) => void;
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
    size: number;

    /**
     * Timestamp when the upload completed
     */
    uploadedAt: Date;

    /**
     * Provider-specific metadata (e.g., GCS generation, S3 ETag)
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
     * @returns true if the provider can be used
     */
    isAvailable(): Promise<boolean>;

    /**
     * Upload a video blob to storage
     * @param blob - Video blob to upload
     * @param filename - Desired filename (will be made unique)
     * @param options - Upload options (content-type, cache, etc.)
     * @returns Upload result with public URL
     * @throws Error if upload fails
     */
    upload(
        blob: Blob,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult>;

    /**
     * Get the public URL for an already-uploaded file
     * @param path - Internal path/key of the file
     * @returns Public URL
     */
    getPublicUrl(path: string): string;
}

/**
 * Factory for managing and selecting storage providers
 */
export class VideoStorageFactory {
    private static providers: Map<StorageProvider, VideoStorageProvider> = new Map();
    private static defaultProvider: StorageProvider | null = null;
    private static initialized = false;

    /**
     * Register a storage provider
     * @param provider - Provider instance to register
     */
    static register(provider: VideoStorageProvider): void {
        this.providers.set(provider.name, provider);

        // Set first registered provider as default
        if (!this.defaultProvider) {
            this.defaultProvider = provider.name;
        }
    }

    /**
     * Initialize default providers if needed
     * This is a lazy initialization helper
     */
    static async ensureInitialized(providers: VideoStorageProvider[]) {
        if (this.initialized) return;

        for (const provider of providers) {
            this.register(provider);
        }
        this.initialized = true;
    }

    /**
     * Get the first available provider (checks in registration order)
     * @returns Available provider or null if none are configured
     */
    static async getAvailableProvider(): Promise<VideoStorageProvider | null> {
        // Try default provider first
        if (this.defaultProvider) {
            const provider = this.providers.get(this.defaultProvider);
            if (provider && await provider.isAvailable()) {
                return provider;
            }
        }

        // Fallback to any available provider
        for (const provider of this.providers.values()) {
            if (await provider.isAvailable()) {
                return provider;
            }
        }

        return null;
    }

    /**
     * Get a specific provider by name
     * @param name - Provider identifier
     * @returns Provider instance or null if not registered
     */
    static getProvider(name: StorageProvider): VideoStorageProvider | null {
        return this.providers.get(name) || null;
    }

    /**
     * Reset registry
     */
    static reset(): void {
        this.providers.clear();
        this.defaultProvider = null;
        this.initialized = false;
    }
}
