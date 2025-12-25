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

export const concatenateVideos = async (videoUrls, outputFilename) => {
    const tempDir = path.join(process.cwd(), 'temp_videos');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFiles = [];

    try {
        // 1. Download all videos
        console.log(`[VideoService] Downloading ${videoUrls.length} videos...`);

        for (let i = 0; i < videoUrls.length; i++) {
            const url = videoUrls[i];
            const tempPath = path.join(tempDir, `clip_${Date.now()}_${i}.mp4`);
            await downloadFile(url, tempPath);
            tempFiles.push(tempPath);
        }

        // 2. Concatenate
        const outputPath = path.join(tempDir, outputFilename || `output_${Date.now()}.mp4`);
        console.log(`[VideoService] Concatenating to ${outputPath}...`);

        await new Promise((resolve, reject) => {
            let command = ffmpeg();

            tempFiles.forEach(file => {
                command = command.input(file);
            });

            command
                .on('error', (err) => {
                    console.error('[VideoService] FFmpeg error:', err);
                    reject(err);
                })
                .on('end', () => {
                    console.log('[VideoService] FFmpeg process finished');
                    resolve();
                })
                .mergeToFile(outputPath, tempDir);
        });

        // 3. Return path to result (caller must handle reading/sending/deleting)
        return {
            path: outputPath,
            cleanup: () => {
                // Clean up inputs immediately
                tempFiles.forEach(f => {
                    if (fs.existsSync(f)) fs.unlinkSync(f);
                });
                // Caller responsible for cleaning up output after sending
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }
        };

    } catch (error) {
        // Cleanup on error
        tempFiles.forEach(f => {
            if (fs.existsSync(f)) fs.unlinkSync(f);
        });
        console.error('[VideoService] Fusion failed:', error);
        throw error;
    }
};
