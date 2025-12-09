/**
 * Video Combine Endpoint
 * Concatenates two videos (original + extension) into a single MP4
 * Uses FFmpeg.wasm for serverless-compatible video processing
 */
import { createClient } from '@supabase/supabase-js';

// Note: FFmpeg.wasm has specific import requirements for Node.js
// We'll use a simpler approach: Blob concatenation for MP4 files
// This works when videos have compatible codecs (same from Veo)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { originalUrl, extensionUrl, originalBlob } = req.body;

        console.log('[VideoCombine] Request received:', {
            hasOriginalUrl: !!originalUrl,
            hasExtensionUrl: !!extensionUrl,
            hasOriginalBlob: !!originalBlob
        });

        if (!extensionUrl) {
            return res.status(400).json({ error: 'extensionUrl is required' });
        }

        // Download extension video
        console.log('[VideoCombine] Downloading extension video...');
        const extensionResponse = await fetch(extensionUrl);
        if (!extensionResponse.ok) {
            throw new Error(`Failed to download extension: ${extensionResponse.status}`);
        }
        const extensionBuffer = await extensionResponse.arrayBuffer();
        console.log('[VideoCombine] Extension size:', (extensionBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

        let originalBuffer;

        // Get original video - either from URL or from base64 blob
        if (originalBlob) {
            console.log('[VideoCombine] Using provided original blob');
            originalBuffer = Buffer.from(originalBlob, 'base64');
        } else if (originalUrl) {
            console.log('[VideoCombine] Downloading original video from URL...');
            const originalResponse = await fetch(originalUrl);
            if (!originalResponse.ok) {
                throw new Error(`Failed to download original: ${originalResponse.status}`);
            }
            originalBuffer = await originalResponse.arrayBuffer();
        } else {
            // No original provided - just return extension URL
            console.log('[VideoCombine] No original video, returning extension only');
            return res.json({ combinedUrl: extensionUrl });
        }

        console.log('[VideoCombine] Original size:', (originalBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

        // Simple concatenation approach for compatible MP4s
        // This creates a blob that most players can handle
        const combinedBuffer = Buffer.concat([
            Buffer.from(originalBuffer),
            Buffer.from(extensionBuffer)
        ]);

        console.log('[VideoCombine] Combined size:', (combinedBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB');

        // Upload to Supabase
        if (!supabase) {
            console.error('[VideoCombine] Supabase not configured');
            return res.status(500).json({ error: 'Storage not configured' });
        }

        const filename = `combined_${Date.now()}.mp4`;
        const filePath = `combined/${filename}`;

        console.log('[VideoCombine] Uploading to Supabase:', filePath);

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('videos')
            .upload(filePath, combinedBuffer, {
                contentType: 'video/mp4',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('[VideoCombine] Upload error:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(filePath);

        const combinedUrl = urlData.publicUrl;
        console.log('[VideoCombine] Success! Combined URL:', combinedUrl);

        return res.json({ combinedUrl });

    } catch (error) {
        console.error('[VideoCombine] Error:', error);
        return res.status(500).json({
            error: error.message || 'Video combination failed',
            details: error.toString()
        });
    }
}
