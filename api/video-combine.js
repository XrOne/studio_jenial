/**
 * Video Combine Endpoint
 * Concatenates two videos (original + extension) into a single MP4 using FFmpeg (Server-Side).
 * 
 * Strategy:
 * 1. Receive URLs (not blobs) to avoid 413 Payload Too Large.
 * 2. Download inputs to temp storage.
 * 3. Use fluent-ffmpeg + ffmpeg-static to concat.
 * 4. Upload result to Supabase.
 */
import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Helper to download URL to file
async function downloadFile(url, outputPath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(response.body, fileStream);
}

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

    const tempDir = os.tmpdir();
    const inputPath1 = path.join(tempDir, `input1_${Date.now()}.mp4`);
    const inputPath2 = path.join(tempDir, `input2_${Date.now()}.mp4`);
    // Output path to .mp4 to ensure container format
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

    try {
        const { originalUrl, extensionUrl } = req.body;

        console.log('[VideoCombine] Request received:', {
            hasOriginalUrl: !!originalUrl,
            hasExtensionUrl: !!extensionUrl
        });

        if (!originalUrl || !extensionUrl) {
            return res.status(400).json({ error: 'originalUrl and extensionUrl are required' });
        }

        // 1. Download Inputs
        console.log('[VideoCombine] Downloading inputs...');
        await Promise.all([
            downloadFile(originalUrl, inputPath1),
            downloadFile(extensionUrl, inputPath2)
        ]);
        console.log('[VideoCombine] Downloads complete.');

        // 2. Perform FFmpeg Fusion
        console.log('[VideoCombine] Starting FFmpeg fusion...');
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(inputPath1)
                .input(inputPath2)
                .on('start', (cmd) => console.log('[VideoCombine] FFmpeg command:', cmd))
                .on('end', resolve)
                .on('error', (err) => reject(err))
                .mergeToFile(outputPath, tempDir);
        });
        console.log('[VideoCombine] FFmpeg fusion complete.');

        // Verify output exists and has size
        const stats = fs.statSync(outputPath);
        console.log('[VideoCombine] Output size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

        if (stats.size === 0) throw new Error('Output file is empty');

        // 3. Upload to Supabase
        if (!supabase) {
            throw new Error('Supabase storage not configured');
        }

        const filename = `combined_${Date.now()}.mp4`;
        const storagePath = `combined/${filename}`;
        const fileContent = fs.readFileSync(outputPath);

        console.log('[VideoCombine] Uploading to Supabase:', storagePath);
        const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(storagePath, fileContent, {
                contentType: 'video/mp4',
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from('videos')
            .getPublicUrl(storagePath);

        const combinedUrl = urlData.publicUrl;
        console.log('[VideoCombine] Success! URL:', combinedUrl);

        return res.json({ combinedUrl });

    } catch (error) {
        console.error('[VideoCombine] Error:', error);
        return res.status(500).json({
            error: error.message || 'Video combination failed',
            details: error.toString()
        });
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(inputPath1)) fs.unlinkSync(inputPath1);
            if (fs.existsSync(inputPath2)) fs.unlinkSync(inputPath2);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
            console.warn('[VideoCombine] Cleanup warning:', e.message);
        }
    }
}

