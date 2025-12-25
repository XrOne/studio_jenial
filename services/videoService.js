import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete the file async
            reject(err);
        });
    });
};

export const concatenateVideos = async (videoUrls, outputFilename, options = {}) => {
    const { width, height, fps } = options;
    const tempDir = path.join(process.cwd(), 'temp_videos');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFiles = [];

    try {
        // 1. Download all videos
        console.log(`[VideoService] Downloading ${videoUrls.length} videos...`);
        console.log(`[VideoService] Target Settings: ${width}x${height} @ ${fps}fps`);

        for (let i = 0; i < videoUrls.length; i++) {
            const url = videoUrls[i];
            const tempPath = path.join(tempDir, `clip_${Date.now()}_${i}.mp4`);
            await downloadFile(url, tempPath);
            tempFiles.push(tempPath);
        }

        // 2. Concatenate & Transcode
        const outputPath = path.join(tempDir, outputFilename || `output_${Date.now()}.mp4`);
        console.log(`[VideoService] Processing to ${outputPath}...`);

        await new Promise((resolve, reject) => {
            let command = ffmpeg();

            tempFiles.forEach(file => {
                command = command.input(file);
            });

            // Complex Filter for Scaling, Padding, and FPS
            // Note: We use a simple concat filter here if we want to normalize inputs first,
            // but for simplicity/robustness with potentially mixed inputs, we might want to scale inputs individually?
            // "safe 0" is for concat demuxer, but here we are adding inputs directly which uses complex_filter `concat`
            
            // Construct complex filter:
            // [0:v]scale=w:h:force_original_aspect_ratio=decrease,pad=w:h:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=fps[v0];
            // ... for each input
            // [v0][v1]...concat=n=N:v=1:a=0[outv]
            // Note: Audio matching is harder without re-encoding audio tracks. For now ignoring audio complications or assuming silent/matching.
            
            // SIMPLIFIED APPROACH:
            // 1. Just Use standard fluent-ffmpeg merge (concat demuxer) if inputs are same codec.
            // 2. BUT user wants RESIZING. Concat demuxer fails if resolutions differ.
            // 3. Robust approach: Filter Complex.
            
            const inputs = tempFiles.map((_, i) => `[${i}:v]`);
            
            // Generate filter string for each input to normalize it
            const filterChains = tempFiles.map((_, i) => {
                const scaleFilter = `scale=${width || 1920}:${height || 1080}:force_original_aspect_ratio=decrease`;
                const padFilter = `pad=${width || 1920}:${height || 1080}:(ow-iw)/2:(oh-ih)/2`;
                const fpsFilter = fps ? `,fps=${fps}` : '';
                return `[${i}:v]${scaleFilter},${padFilter},setsar=1${fpsFilter}[v${i}]`;
            });
            
            const concatInput = tempFiles.map((_, i) => `[v${i}]`).join('');
            const concatFilter = `${concatInput}concat=n=${tempFiles.length}:v=1:a=0[outv]`;

            command
                .complexFilter([
                    ...filterChains,
                    concatFilter
                ], ['outv']) // Map final output
                .outputOptions([
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 22',
                    '-pix_fmt yuv420p',
                    ...(fps ? ['-r', `${fps}`] : [])
                ])
                .on('error', (err) => {
                    console.error('[VideoService] FFmpeg error:', err);
                    reject(err);
                })
                .on('end', () => {
                    console.log('[VideoService] FFmpeg process finished');
                    resolve();
                })
                .save(outputPath);
        });

        // 3. Return path to result
        return {
            path: outputPath,
            cleanup: () => {
                tempFiles.forEach(f => {
                    if (fs.existsSync(f)) fs.unlinkSync(f);
                });
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
        };

    } catch (error) {
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        console.error('[VideoService] Fusion failed:', error);
        throw error;
    }
};
