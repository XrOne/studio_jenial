import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
    StorageProvider,
    VideoStorageProvider,
    UploadResult,
    UploadOptions
} from '../VideoStorageProvider';

/**
 * Supabase implementation of VideoStorageProvider
 */
export class SupabaseVideoStorage implements VideoStorageProvider {
    readonly name = StorageProvider.SUPABASE;
    private supabase: SupabaseClient | null = null;
    private bucketName = 'videos';

    constructor(
        private supabaseUrl?: string,
        private supabaseKey?: string,
        bucketName?: string
    ) {
        // Try to load from env if not provided
        this.supabaseUrl = supabaseUrl || this.getEnvVar('VITE_SUPABASE_URL');
        this.supabaseKey = supabaseKey || this.getEnvVar('VITE_SUPABASE_ANON_KEY');

        if (bucketName) {
            this.bucketName = bucketName;
        }

        if (this.supabaseUrl && this.supabaseKey) {
            this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        }
    }

    /**
     * Helper to get env vars safely in both Browser/Node
     */
    private getEnvVar(key: string): string | undefined {
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
            return meta.env[key];
        }
        try {
            if (typeof process !== 'undefined' && process.env && process.env[key]) {
                return process.env[key];
            }
        } catch (e) { }
        return undefined;
    }

    async isAvailable(): Promise<boolean> {
        return !!this.supabase;
    }

    async upload(
        blob: Blob,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized');
        }

        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${filename}`;
        // Organize by year/month/day if needed, but for now flat structure in 'generated/'
        const path = `generated/${uniqueFilename}`;

        const contentType = options?.contentType || 'video/mp4';
        const cacheControl = options?.cacheControl || '3600';

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(path, blob, {
                contentType,
                cacheControl,
                upsert: false
            });

        if (error) {
            console.error('[SupabaseStorage] Upload failed:', error);
            throw new Error(`Supabase upload failed: ${error.message}`);
        }

        // Generate public URL
        const { data: publicURLData } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);

        console.log(`[SupabaseStorage] Uploaded: ${publicURLData.publicUrl}`);

        return {
            publicUrl: publicURLData.publicUrl,
            provider: this.name,
            path: path,
            size: blob.size,
            uploadedAt: new Date(timestamp),
            providerMetadata: {
                bucket: this.bucketName,
                id: data?.id
            }
        };
    }

    getPublicUrl(path: string): string {
        if (!this.supabase) {
            return '';
        }
        const { data } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);

        return data.publicUrl;
    }
}
