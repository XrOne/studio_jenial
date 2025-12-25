/**
 * AI Super-Resolution Upscale Service
 * Uses Real-ESRGAN NCNN Vulkan for true AI-powered upscaling.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

// Paths
const REALESRGAN_DIR = path.join(process.cwd(), 'bin', 'realesrgan');
const REALESRGAN_EXE = path.join(REALESRGAN_DIR, 'realesrgan-ncnn-vulkan.exe');
const MODELS_DIR = path.join(REALESRGAN_DIR, 'models');

/**
 * Check if AI Upscaling is available
 * @returns {boolean} True if the binary exists
 */
export const isAIUpscaleAvailable = () => {
    return fs.existsSync(REALESRGAN_EXE);
};

/**
 * Get available upscaling models
 * @returns {string[]} List of model names
 */
export const getAvailableModels = () => {
    if (!fs.existsSync(MODELS_DIR)) return [];

    const files = fs.readdirSync(MODELS_DIR);
    // Models have .param and .bin files, extract unique base names
    const models = new Set();
    files.forEach(f => {
        const match = f.match(/^(.+?)-x\d+\.param$/);
        if (match) {
            models.add(match[1]);
        }
    });
    return Array.from(models);
};

/**
 * Extract video frames using FFmpeg
 * @param {string} inputVideo - Path to input video
 * @param {string} outputDir - Directory to save frames
 * @returns {Promise<number>} Frame count
 */
const extractFrames = (inputVideo, outputDir) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`[Upscale] Extracting frames from ${inputVideo}...`);

        ffmpeg(inputVideo)
            .outputOptions(['-qscale:v', '2']) // High quality JPEGs
            .output(path.join(outputDir, 'frame_%08d.png'))
            .on('end', () => {
                const frames = fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).length;
                console.log(`[Upscale] Extracted ${frames} frames.`);
                resolve(frames);
            })
            .on('error', reject)
            .run();
    });
};

/**
 * Upscale frames using Real-ESRGAN
 * @param {string} inputDir - Directory with input frames
 * @param {string} outputDir - Directory for upscaled frames
 * @param {object} options - Upscale options
 * @returns {Promise<void>}
 */
const upscaleFrames = (inputDir, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const model = options.model || 'realesrgan-x4plus';
        const scale = options.scale || 2; // 2x or 4x

        console.log(`[Upscale] Starting AI upscale with model: ${model}, scale: x${scale}`);

        const args = [
            '-i', inputDir,
            '-o', outputDir,
            '-n', model,
            '-s', scale.toString(),
            '-f', 'png'
        ];

        // Use GPU 0 by default
        args.push('-g', '0');

        const proc = spawn(REALESRGAN_EXE, args, {
            cwd: REALESRGAN_DIR
        });

        let stderr = '';

        proc.stdout.on('data', (data) => {
            console.log(`[RealESRGAN] ${data}`);
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            // Real-ESRGAN outputs progress to stderr
            const progressMatch = data.toString().match(/(\d+\.\d+)%/);
            if (progressMatch) {
                console.log(`[Upscale] Progress: ${progressMatch[1]}%`);
            }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log('[Upscale] AI upscaling complete.');
                resolve();
            } else {
                reject(new Error(`Real-ESRGAN exited with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', reject);
    });
};

/**
 * Reassemble frames into video using FFmpeg
 * @param {string} framesDir - Directory with upscaled frames
 * @param {string} outputVideo - Output video path
 * @param {object} options - Encoding options
 * @returns {Promise<string>} Output video path
 */
const reassembleVideo = (framesDir, outputVideo, options = {}) => {
    return new Promise((resolve, reject) => {
        const fps = options.fps || 30;

        console.log(`[Upscale] Reassembling video at ${fps}fps...`);

        ffmpeg()
            .input(path.join(framesDir, 'frame_%08d.png'))
            .inputFPS(fps)
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'slow',
                '-crf', '18', // High quality
                '-pix_fmt', 'yuv420p',
                '-r', fps.toString()
            ])
            .output(outputVideo)
            .on('end', () => {
                console.log(`[Upscale] Video reassembled: ${outputVideo}`);
                resolve(outputVideo);
            })
            .on('error', reject)
            .run();
    });
};

/**
 * Full AI Upscale Pipeline
 * @param {string} inputVideo - Path to input video
 * @param {string} outputVideo - Path for output video
 * @param {object} options - { model, scale, fps }
 * @returns {Promise<{ path: string, cleanup: function }>}
 */
export const upscaleVideo = async (inputVideo, outputVideo, options = {}) => {
    if (!isAIUpscaleAvailable()) {
        throw new Error('AI_UPSCALE_NOT_AVAILABLE');
    }

    const tempDir = path.join(process.cwd(), 'temp_upscale', `job_${Date.now()}`);
    const framesRaw = path.join(tempDir, 'frames_raw');
    const framesUpscaled = path.join(tempDir, 'frames_upscaled');

    try {
        // 1. Extract frames
        await extractFrames(inputVideo, framesRaw);

        // 2. AI Upscale each frame
        await upscaleFrames(framesRaw, framesUpscaled, {
            model: options.model || 'realesrgan-x4plus',
            scale: options.scale || 2
        });

        // 3. Reassemble video
        const finalOutput = outputVideo || path.join(tempDir, 'output_upscaled.mp4');
        await reassembleVideo(framesUpscaled, finalOutput, { fps: options.fps || 30 });

        return {
            path: finalOutput,
            cleanup: () => {
                // Clean up temp directories
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        };

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        throw error;
    }
};
