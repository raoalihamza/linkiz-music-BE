import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert video/audio to MP3 320kbps
 */
export function convertToMP3(inputPath, outputFilename) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate(320)
      .toFormat('mp3')
      .on('start', (commandLine) => {
        console.log('FFmpeg started:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.floor(progress.percent)}% done`);
        }
      })
      .on('end', () => {
        console.log('MP3 conversion finished');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(new Error('Failed to convert to MP3'));
      })
      .save(outputPath);
  });
}

/**
 * Convert video to MP4 HD (1080p)
 */
export function convertToMP4HD(inputPath, outputFilename) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size('1920x1080')
      .videoBitrate('5000k')
      .audioBitrate('192k')
      .toFormat('mp4')
      .outputOptions([
        '-preset fast',
        '-crf 22',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg started:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.floor(progress.percent)}% done`);
        }
      })
      .on('end', () => {
        console.log('MP4 HD conversion finished');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(new Error('Failed to convert to MP4 HD'));
      })
      .save(outputPath);
  });
}

/**
 * Convert video to MP4 SD (720p)
 */
export function convertToMP4SD(inputPath, outputFilename) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .size('1280x720')
      .videoBitrate('2500k')
      .audioBitrate('128k')
      .toFormat('mp4')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .on('start', (commandLine) => {
        console.log('FFmpeg started:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.floor(progress.percent)}% done`);
        }
      })
      .on('end', () => {
        console.log('MP4 SD conversion finished');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(new Error('Failed to convert to MP4 SD'));
      })
      .save(outputPath);
  });
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * Format duration (seconds) to MM:SS
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
