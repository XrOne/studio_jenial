import { StorageProvider, VideoStorageProvider } from './types.js';

/**
 * Factory for managing and selecting storage providers
 */
export class VideoStorageFactory {
    private static providers: Map<StorageProvider, VideoStorageProvider> = new Map();
    private static defaultProvider: StorageProvider | null = null;

    /**
     * Register a storage provider
     */
    static register(provider: VideoStorageProvider): void {
        this.providers.set(provider.name, provider);
        console.log(`[StorageFactory] Registered provider: ${provider.name}`);

        // Set first registered provider as default
        if (!this.defaultProvider) {
            this.defaultProvider = provider.name;
        }
    }

    /**
     * Get the available provider
     */
    static async getProvider(): Promise<VideoStorageProvider> {
        // 1. Try default
        if (this.defaultProvider) {
            const provider = this.providers.get(this.defaultProvider);
            if (provider && await provider.isAvailable()) {
                return provider;
            }
        }

        // 2. Fallback to any available
        for (const provider of this.providers.values()) {
            if (await provider.isAvailable()) {
                console.log(`[StorageFactory] Default provider unavailable, falling back to ${provider.name}`);
                return provider;
            }
        }

        throw new Error('No storage providers configured or available');
    }

    /**
     * Set explicit default provider
     */
    static setDefaultProvider(name: StorageProvider): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider ${name} is not registered`);
        }
        this.defaultProvider = name;
    }
}
