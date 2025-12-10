/**
 * Video Combine Endpoint
 * For external video continuations: stores both videos and returns their URLs.
 * 
 * IMPORTANT: Simple binary concatenation of MP4 files does NOT work.
 * MP4 has a complex structure (ftyp, moov, mdat atoms) that must be properly merged.
 * True video fusion requires FFmpeg or similar tool.
 * 
 * Current approach: Return both URLs, let frontend handle sequential playback/download.
 */
import { createClient } from '@supabase/supabase-js';

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
        const { originalBlob, extensionUrl } = req.body;

        console.log('[VideoCombine] Request received:', {
            hasOriginalBlob: !!originalBlob,
            originalBlobSize: originalBlob ? `${(originalBlob.length / 1024).toFixed(0)}KB` : 'none',
            hasExtensionUrl: !!extensionUrl
        });

        if (!extensionUrl) {
            return res.status(400).json({ error: 'extensionUrl is required' });
        }

        let originalUrl = null;

        // If original blob provided, upload it to Supabase for later download
        if (originalBlob && supabase) {
            try {
                const originalBuffer = Buffer.from(originalBlob, 'base64');
                console.log('[VideoCombine] Original video size:', (originalBuffer.length / 1024 / 1024).toFixed(2), 'MB');

                const filename = `original_${Date.now()}.mp4`;
                const filePath = `continuity/${filename}`;

                const { error: uploadError } = await supabase.storage
                    .from('videos')
                    .upload(filePath, originalBuffer, {
                        contentType: 'video/mp4',
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.warn('[VideoCombine] Original upload failed:', uploadError.message);
                } else {
                    const { data: urlData } = supabase.storage
                        .from('videos')
                        .getPublicUrl(filePath);
                    originalUrl = urlData.publicUrl;
                    console.log('[VideoCombine] Original URL:', originalUrl);
                }
            } catch (e) {
                console.warn('[VideoCombine] Failed to process original:', e.message);
            }
        }

        console.log('[VideoCombine] Returning video URLs:', {
            originalUrl: originalUrl ? 'set' : 'none',
            extensionUrl: extensionUrl.substring(0, 50) + '...'
        });

        // Return both URLs - frontend will handle sequential playback
        // NOTE: True MP4 fusion requires FFmpeg. Simple concat produces corrupted files.
        return res.json({
            originalUrl,
            extensionUrl,
            // Flag to indicate this is a two-part response
            isSeparate: true,
            message: 'Videos are separate. Download or play sequentially.'
        });

    } catch (error) {
        console.error('[VideoCombine] Error:', error);
        return res.status(500).json({
            error: error.message || 'Video processing failed',
            details: error.toString()
        });
    }
}

