import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, UploadOptions, UploadResult, VideoStorageProvider } from '../types.js';

export class SupabaseVideoStorage implements VideoStorageProvider {
    readonly name = StorageProvider.SUPABASE;
    private supabase: SupabaseClient | null = null;
    private bucketName = 'videos';

    constructor() {
        // Initialize Supabase only if env vars are present
        // Check for both VITE_ (frontend reused) and standard Node env vars
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

        if (url && key) {
            this.supabase = createClient(url, key);
        } else {
            console.warn('[SupabaseStorage] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!this.supabase;
    }

    async upload(
        file: Buffer | ArrayBuffer,
        filename: string,
        options?: UploadOptions
    ): Promise<UploadResult> {
        if (!this.supabase) {
            throw new Error('Supabase client is not initialized');
        }

        const uniqueFilename = `${Date.now()}-${filename}`;
        const filePath = `generated/${uniqueFilename}`;

        const contentType = options?.contentType || 'video/mp4';
        const cacheControl = options?.cacheControl || '3600';

        console.log(`[SupabaseStorage] Uploading ${filePath} (${contentType})`);

        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(filePath, file, {
                contentType,
                cacheControl,
                upsert: false
            });

        if (error) {
            console.error('[SupabaseStorage] Upload failed:', error);
            throw new Error(`Supabase upload failed: ${error.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(filePath);

        // Assuming file is Buffer/ArrayBuffer, getting size might be tricky without fs access for Stream
        // For Buffer:
        const size = file instanceof Buffer ? file.length : (file as ArrayBuffer).byteLength;

        return {
            publicUrl,
            provider: this.name,
            path: filePath,
            uploadedAt: new Date(),
            size: size || 0
        };
    }

    getPublicUrl(path: string): string {
        if (!this.supabase) return '';
        const { data: { publicUrl } } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);
        return publicUrl;
    }
}
