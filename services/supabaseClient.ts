
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { createClient } from '@supabase/supabase-js';

// Helper to safely retrieve environment variables in both Vite (client) and Node (server) environments
const getEnvVar = (key: string) => {
  // 1. Try Vite's import.meta.env (Client-side)
  // Cast to any to avoid TS errors when vite/client types are missing or not picked up
  const meta = import.meta as any;
  if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
    return meta.env[key];
  }
  // 2. Try Node's process.env (Server-side)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore ReferenceErrors if process is not defined in strict browser environments
  }
  return undefined;
};

// Direct access is required for Vite production builds (static replacement)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('--- SUPABASE CONFIG ---');
console.log('URL configured:', !!supabaseUrl);
console.log('Key configured:', !!supabaseKey);
console.log('-----------------------');

// Only create the client if keys are present
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isSupabaseConfigured = () => !!supabase;

/**
 * Upload a video file to Supabase Storage
 * @param blob - Video blob from generation
 * @param filename - Desired filename (will be made unique)
 * @returns Public URL of the uploaded video
 */
export const uploadVideoToSupabase = async (
  blob: Blob,
  filename: string = `video-${Date.now()}.mp4`
): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = `generated/${uniqueFilename}`;

  const { data, error } = await supabase.storage
    .from('videos')
    .upload(filePath, blob, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Supabase video upload error:', error);
    throw new Error(`Failed to upload video to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('videos')
    .getPublicUrl(filePath);

  console.log('Video uploaded to Supabase:', publicUrl);
  return publicUrl;
};

/**
 * Upload an image file to Supabase Storage
 * @param blob - Image blob
 * @param filename - Desired filename (will be made unique)
 * @returns Public URL of the uploaded image
 */
export const uploadImageToSupabase = async (
  blob: Blob,
  filename: string = `image-${Date.now()}.png`
): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }

  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = `generated/${uniqueFilename}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, blob, {
      contentType: blob.type || 'image/png',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Supabase image upload error:', error);
    throw new Error(`Failed to upload image to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  console.log('Image uploaded to Supabase:', publicUrl);
  return publicUrl;
};

/**
 * Upload a thumbnail to Supabase Storage
 * @param base64 - Base64 encoded thumbnail
 * @param filename - Desired filename
 * @returns Public URL of the uploaded thumbnail
 */
export const uploadThumbnailToSupabase = async (
  base64: string,
  filename: string = `thumb-${Date.now()}.jpg`
): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Convert base64 to blob
  const response = await fetch(`data:image/jpeg;base64,${base64}`);
  const blob = await response.blob();

  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = `thumbnails/${uniqueFilename}`;

  const { data, error } = await supabase.storage
    .from('thumbnails')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Supabase thumbnail upload error:', error);
    throw new Error(`Failed to upload thumbnail to Supabase: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('thumbnails')
    .getPublicUrl(filePath);

  console.log('Thumbnail uploaded to Supabase:', publicUrl);
  return publicUrl;
};

/**
 * Save media metadata to database (optional)
 */
export const saveMediaMetadata = async (metadata: {
  userId?: string;
  mediaType: 'video' | 'image' | 'thumbnail';
  storagePath: string;
  publicUrl: string;
  modelUsed?: string;
  prompt?: string;
  metadata?: Record<string, any>;
}): Promise<void> => {
  if (!supabase) return;

  const { error } = await supabase
    .from('media_metadata')
    .insert({
      user_id: metadata.userId || 'anonymous',
      media_type: metadata.mediaType,
      storage_path: metadata.storagePath,
      public_url: metadata.publicUrl,
      model_used: metadata.modelUsed,
      prompt: metadata.prompt,
      metadata: metadata.metadata
    });

  if (error) {
    console.error('Failed to save media metadata:', error);
    // Don't throw - metadata is optional
  }
};

/**
 * Get a time-limited signed URL for private storage access
 * Use this instead of getPublicUrl() when buckets are private
 * @param bucket - Bucket name (videos, images, thumbnails)
 * @param filePath - Path within the bucket
 * @param expiresInSeconds - URL validity (default 1 hour)
 * @returns Signed URL with temporary access token
 */
export const getSignedUrl = async (
  bucket: string,
  filePath: string,
  expiresInSeconds: number = 3600
): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error('Failed to create signed URL:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
};

/**
 * Get signed URLs for multiple files at once (batch operation)
 * @param bucket - Bucket name
 * @param filePaths - Array of file paths
 * @param expiresInSeconds - URL validity (default 1 hour)
 */
export const getSignedUrls = async (
  bucket: string,
  filePaths: string[],
  expiresInSeconds: number = 3600
): Promise<{ path: string; signedUrl: string }[]> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(filePaths, expiresInSeconds);

  if (error) {
    console.error('Failed to create signed URLs:', error);
    throw new Error(`Failed to create signed URLs: ${error.message}`);
  }

  return data.map((item) => ({
    path: item.path || '',
    signedUrl: item.signedUrl || ''
  }));
};
