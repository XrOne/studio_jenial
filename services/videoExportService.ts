/**
 * Video Export Service
 * Uses FFmpeg WASM for browser-based video export
 * 
 * MVP: Export V1 track only with cuts (trim)
 * Future: Multi-track overlay, audio mix
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { SegmentWithUI, Track } from '../types/timeline';

// FFmpeg instance (singleton)
let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

export interface ExportProgress {
    stage: 'loading' | 'processing' | 'encoding' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
}

export interface ExportOptions {
    resolution?: { width: number; height: number };
    fps?: number;
    quality?: 'low' | 'medium' | 'high';
    outputFormat?: 'mp4' | 'webm';
}

export type ProgressCallback = (progress: ExportProgress) => void;

/**
 * Initialize FFmpeg WASM
 */
export async function initFFmpeg(onProgress?: ProgressCallback): Promise<boolean> {
    if (isLoaded && ffmpeg) return true;

    try {
        onProgress?.({ stage: 'loading', progress: 0, message: 'Loading FFmpeg WASM...' });

        ffmpeg = new FFmpeg();

        // Use CDN for core files
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

        ffmpeg.on('progress', ({ progress }) => {
            onProgress?.({
                stage: 'encoding',
                progress: Math.round(progress * 100),
                message: `Encoding: ${Math.round(progress * 100)}%`
            });
        });

        ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        isLoaded = true;
        onProgress?.({ stage: 'loading', progress: 100, message: 'FFmpeg loaded' });
        return true;
    } catch (error) {
        console.error('[VideoExport] Failed to load FFmpeg:', error);
        onProgress?.({ stage: 'error', progress: 0, message: 'Failed to load FFmpeg' });
        return false;
    }
}

/**
 * Export V1 track segments to MP4 (MVP)
 */
export async function exportV1Track(
    segments: SegmentWithUI[],
    tracks: Track[],
    options: ExportOptions = {},
    onProgress?: ProgressCallback
): Promise<Blob | null> {
    // Filter to V1 track segments only
    const v1Track = tracks.find(t => t.type === 'video' && t.id === 'v1');
    if (!v1Track) {
        onProgress?.({ stage: 'error', progress: 0, message: 'V1 track not found' });
        return null;
    }

    const v1Segments = segments
        .filter(s => s.trackId === 'v1')
        .sort((a, b) => a.inSec - b.inSec);

    if (v1Segments.length === 0) {
        onProgress?.({ stage: 'error', progress: 0, message: 'No segments on V1' });
        return null;
    }

    // Initialize FFmpeg
    if (!await initFFmpeg(onProgress)) {
        return null;
    }

    if (!ffmpeg) return null;

    try {
        onProgress?.({ stage: 'processing', progress: 0, message: 'Preparing segments...' });

        const {
            resolution = { width: 1920, height: 1080 },
            fps = 30,
            quality = 'medium',
            outputFormat = 'mp4'
        } = options;

        // Quality presets
        const crfMap = { low: 28, medium: 23, high: 18 };
        const crf = crfMap[quality];

        const inputFiles: string[] = [];
        const filterParts: string[] = [];

        // Process each segment
        for (let i = 0; i < v1Segments.length; i++) {
            const segment = v1Segments[i];
            const videoUrl = segment.mediaSrc || segment.activeRevision?.videoUrl;

            if (!videoUrl) continue;

            const inputName = `input${i}.mp4`;

            onProgress?.({
                stage: 'processing',
                progress: Math.round((i / v1Segments.length) * 50),
                message: `Loading segment ${i + 1}/${v1Segments.length}...`
            });

            // Fetch and write input file
            const fileData = await fetchFile(videoUrl);
            await ffmpeg.writeFile(inputName, fileData);
            inputFiles.push(inputName);

            // Build trim filter
            const startSec = segment.sourceInSec ?? 0;
            const endSec = segment.sourceOutSec ?? segment.durationSec;

            filterParts.push(
                `[${i}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS,scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2[v${i}]`
            );
        }

        if (inputFiles.length === 0) {
            onProgress?.({ stage: 'error', progress: 0, message: 'No valid video files' });
            return null;
        }

        onProgress?.({ stage: 'encoding', progress: 0, message: 'Starting encode...' });

        // Build FFmpeg command
        const inputArgs = inputFiles.flatMap(f => ['-i', f]);

        // Build concat filter
        const videoInputs = inputFiles.map((_, i) => `[v${i}]`).join('');
        const filterComplex = `${filterParts.join(';')};${videoInputs}concat=n=${inputFiles.length}:v=1:a=0[outv]`;

        const outputFile = `output.${outputFormat}`;

        // Run FFmpeg
        await ffmpeg.exec([
            ...inputArgs,
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-c:v', 'libx264',
            '-crf', crf.toString(),
            '-preset', 'fast',
            '-r', fps.toString(),
            '-pix_fmt', 'yuv420p',
            outputFile
        ]);

        // Read output file
        const data = await ffmpeg.readFile(outputFile);
        const blob = new Blob([data], { type: `video/${outputFormat}` });

        // Cleanup
        for (const f of inputFiles) {
            await ffmpeg.deleteFile(f);
        }
        await ffmpeg.deleteFile(outputFile);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Export complete!' });
        return blob;

    } catch (error) {
        console.error('[VideoExport] Export failed:', error);
        onProgress?.({ stage: 'error', progress: 0, message: `Export failed: ${error}` });
        return null;
    }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Quick export: V1 to MP4 download
 */
export async function quickExportV1(
    segments: SegmentWithUI[],
    tracks: Track[],
    filename: string = 'export.mp4',
    onProgress?: ProgressCallback
): Promise<boolean> {
    const blob = await exportV1Track(segments, tracks, {}, onProgress);

    if (blob) {
        downloadBlob(blob, filename);
        return true;
    }

    return false;
}

export default {
    initFFmpeg,
    exportV1Track,
    downloadBlob,
    quickExportV1
};
