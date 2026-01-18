import express from 'express';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.js';
import { quotaMiddleware, incrementDownloadCounter } from '../middleware/quota.js';
import {
  downloadMedia,
  isValidMediaUrl,
  getVideoInfo,
  getDirectDownloadLink
} from '../services/mediaService.js';
import {
  convertToMP3,
  convertToMP4HD,
  convertToMP4SD,
  formatFileSize,
  formatDuration
} from '../services/ffmpegService.js';
import {
  uploadToStorage,
  generateSignedUrl,
  deleteLocalFile
} from '../services/storageService.js';
import { supabase } from '../utils/supabase.js';

const router = express.Router();

/**
 * GET /api/proxy
 * Proxy download for direct links (Instagram/FB) to force download
 */
router.get('/proxy', async (req, res) => {
  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).send('Missing URL');
  }

  try {
    // Sanitize filename to remove invalid header characters
    let finalFilename = filename || 'download.mp4';
    // Remove or replace characters that are invalid in HTTP headers
    finalFilename = finalFilename
      .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
      .replace(/["\\]/g, '')        // Remove quotes and backslashes
      .trim() || 'download.mp4';
    
    // Fetch the file stream from the CDN
    const response = await fetch(decodeURIComponent(url));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');

    // Pipe the web stream to the express response
    // Node 18+ fetch returns a web stream, we need to convert or iterate
    const reader = response.body.getReader();
    
    // Simple stream pumping
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).send('Error proxying download');
  }
})

/**
 * GET /api/proxy-image
 * Proxy images (thumbnails) to avoid CORS issues
 */
router.get('/proxy-image', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing URL');
  }

  try {
    // Fetch the image from the CDN
    const response = await fetch(decodeURIComponent(url));
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Set appropriate headers
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Pipe the web stream to the express response
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (error) {
    console.error('Proxy Image Error:', error);
    res.status(500).send('Error proxying image');
  }
});

/**
 * POST /api/info
 * Get video metadata and available formats
 */
router.post('/info', async (req, res) => {
  const { url } = req.body;

  try {
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    if (!isValidMediaUrl(url)) {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    // Determine platform
    let platform = 'unknown';
    if (url.includes('youtube') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('instagram')) platform = 'instagram';
    else if (url.includes('facebook')) platform = 'facebook';
    else if (url.includes('tiktok')) platform = 'tiktok';
    else if (url.includes('spotify')) platform = 'spotify';
    else if (url.includes('soundcloud')) platform = 'soundcloud';

    console.log(`🔍 fetching info for: ${url} [${platform}]`);

    // Fetch video info
    const videoInfo = await getVideoInfo(url);

    res.json({
      success: true,
      platform,
      title: videoInfo.title,
      author: videoInfo.author, // Pass author info
      uploader: videoInfo.author, // Legacy support
      thumbnail: videoInfo.thumbnail,
      duration: formatDuration(videoInfo.duration),
      qualities: videoInfo.qualities
    });

  } catch (error) {
    console.error('Info fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch video info'
    });
  }
});

/**
 * POST /api/convert
 * Convert Media URL to specified format
 */
router.post('/convert', authMiddleware, quotaMiddleware, async (req, res) => {
  const { url, format, userId } = req.body;

  // --- PREMIUM RESTRICTION LOGIC ---
  // Verify Guest vs Logged In using the middleware's req.user
  const isGuest = !req.user;

  if (isGuest) {
    // 1. Detect Platform
    let platform = 'unknown';
    if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('spotify.com')) platform = 'spotify';
    else if (url.includes('soundcloud.com')) platform = 'soundcloud';
    else if (url.includes('tiktok.com')) platform = 'tiktok';
    else if (url.includes('instagram.com')) platform = 'instagram';
    else if (url.includes('facebook.com') || url.includes('fb.watch')) platform = 'facebook';

    // 2. Check Restrictions
    let isAllowed = true;
    let restrictionReason = '';

    // Rule 1: Spotify & SoundCloud are strictly Premium
    if (platform === 'spotify' || platform === 'soundcloud') {
      isAllowed = false;
      restrictionReason = 'Les téléchargements depuis cette plateforme nécessitent un compte.';
    }

    // Rule 2: Social Media (TikTok/IG/FB) - Audio & HQ Video are Premium
    else if (['tiktok', 'instagram', 'facebook'].includes(platform)) {
      if (format.startsWith('mp3')) {
         isAllowed = false; // All audio is premium
         restrictionReason = 'Le téléchargement audio nécessite un compte.';
      } else if (format.includes('hd') || format.includes('4k') || format.includes('1080p')) {
         isAllowed = false; // HQ Video is premium
         restrictionReason = 'Le téléchargement en Haute Qualité nécessite un compte.';
      }
    }

    // Rule 3: YouTube - >720p Video & >128kbps Audio are Premium
    else if (platform === 'youtube') {
      if (format.startsWith('mp3')) {
        const bitrate = parseInt(format.split('-')[1]) || 0;
        if (bitrate > 128) {
          isAllowed = false;
          restrictionReason = 'L\'audio haute qualité (>128kbps) nécessite un compte.';
        }
      } else if (format.startsWith('mp4')) {
         if (format === 'mp4-4k' || format === 'mp4-hd') {
           isAllowed = false;
           restrictionReason = 'La vidéo HD/4K nécessite un compte.';
         }
      }
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: `Fonctionnalité Premium: ${restrictionReason}`,
        isPremium: true
      });
    }
  }
  // --- END PREMIUM RESTRICTION LOGIC ---

  let downloadedFilePath = null;
  let convertedFilePath = null;
  let storageFilePath = null;

  try {
    // Validate input
    if (!url || !format) {
      return res.status(400).json({
        success: false,
        error: 'URL and format are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Validate Media URL
    if (!isValidMediaUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Media URL. Supported: YouTube, Instagram, Facebook, TikTok, SoundCloud, Spotify.',
        code: 'INVALID_URL'
      });
    }

    // Validate format
    const validFormats = ['mp3-320', 'mp3-192', 'mp3-128', 'mp4-4k', 'mp4-hd', 'mp4-sd'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use: mp3-320, mp3-192, mp3-128, mp4-hd, or mp4-sd',
        code: 'INVALID_FORMAT'
      });
    }

    console.log(`\n🎬 Starting conversion:`);
    console.log(`   URL: ${url}`);
    console.log(`   Format: ${format}`);
    console.log(`   User: ${userId || 'anonymous'}\n`);

    // === FREE PLATFORMS (Instagram, Facebook) ===
    // We use Direct Download ONLY for Standard Quality (mp4-sd) or Low Audio (128kbps)
    // TikTok is excluded due to CDN blocking - it always uses yt-dlp pipeline
    // If user wants HD/4K, we use the Premium Pipeline (yt-dlp) to find better streams
    const isFreePlatform = (url.includes('instagram.com') || 
                           url.includes('facebook.com') || 
                           url.includes('fb.watch'));

    // Free tier for social media: Only Standard Video (720p) and Low Audio (128kbps)
    // Premium tier: High Video (1080p+) and High Audio (320kbps, 192kbps)
    const useDirectDownload = isFreePlatform && (format === 'mp4-sd' || format === 'mp3-128');

    if (useDirectDownload) {
      console.log('⚡ FREE PLATFORM - Providing proxied download link');
      
      // Determine if user wants audio or video
      const directFormat = format.startsWith('mp3') ? 'audio' : 'video';
      const directLink = await getDirectDownloadLink(url, directFormat);
      
      // Increment counter for analytics (disabled for now due to DB error)
      // if (userId) {
      //   await incrementDownloadCounter(userId);
      // }

      // Set appropriate filename extension
      const fileExtension = format.startsWith('mp3') ? 'mp3' : 'mp4';
      const filename = `${directLink.title}.${fileExtension}`;

      // Construct PROXY URL
      // We send the CDN url and filename to our proxy endpoint
      // This forces the "Content-Disposition: attachment" header
      const proxyUrl = `${req.protocol}://${req.get('host')}/api/proxy?url=${encodeURIComponent(directLink.downloadUrl)}&filename=${encodeURIComponent(filename)}`;

      return res.json({
        success: true,
        downloadUrl: proxyUrl, // Return the proxy URL instead of direct link
        filename: filename,
        fileSize: directLink.fileSize,
        duration: directLink.duration,
        platform: 'free'
      });
    }

    // === PAID PLATFORMS (YouTube, Spotify, SoundCloud) - Full Processing ===
    console.log('💎 PREMIUM PLATFORM - Processing with conversion pipeline');

    // Step 1: Get video info
    console.log('📝 Step 1: Fetching video info...');
    const videoInfo = await getVideoInfo(url);
    console.log(`   Title: ${videoInfo.title}`);
    console.log(`   Author: ${videoInfo.author}`);
    console.log(`   Duration: ${formatDuration(videoInfo.duration)}\n`);

    // Step 2: Download video
    console.log('⬇️  Step 2: Downloading media...');
    const downloadFormat = format.startsWith('mp3') ? 'audio' : 'video';
    
    // Determine quality target
    let qualityTarget = 'best'; // Default 1080p compatible
    if (format === 'mp4-4k') qualityTarget = '4k';
    else if (format === 'mp4-sd') qualityTarget = 'standard';
    
    const { filePath: downloadPath } = await downloadMedia(url, downloadFormat, qualityTarget);
    downloadedFilePath = downloadPath;
    console.log(`   Downloaded to: ${downloadPath} [Quality: ${qualityTarget}]\n`);

    // Step 3: Convert to desired format
    console.log('🔄 Step 3: Converting format...');
    let finalFilePath;
    const safeTitle = videoInfo.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    if (format === 'mp3-320') {
      const outputFilename = `${safeTitle}_320kbps.mp3`;
      finalFilePath = await convertToMP3(downloadedFilePath, outputFilename);
      console.log(`   Converted to MP3 320kbps: ${outputFilename}\n`);
    } else if (format === 'mp3-192') {
      const outputFilename = `${safeTitle}_192kbps.mp3`;
      finalFilePath = await convertToMP3(downloadedFilePath, outputFilename, 192);
      console.log(`   Converted to MP3 192kbps: ${outputFilename}\n`);
    } else if (format === 'mp3-128') {
      const outputFilename = `${safeTitle}_128kbps.mp3`;
      finalFilePath = await convertToMP3(downloadedFilePath, outputFilename, 128);
      console.log(`   Converted to MP3 128kbps: ${outputFilename}\n`);
    } else if (format === 'mp4-4k') {
      // === PRO MODE: NO CONVERSION ===
      console.log('⚡ FAST PATH: Using Max resolution download (4K/2K/8K)');
      finalFilePath = downloadedFilePath;
    } else if (format === 'mp4-hd') {
      // === OPTIMIZATION: SKIP FFmpeg RE-ENCODING ===
      console.log('⚡ FAST PATH: Using H.264 compatible download (1080p)');
      finalFilePath = downloadedFilePath; 

    } else if (format === 'mp4-sd') {
      // === OPTIMIZATION: SKIP FFmpeg RE-ENCODING ===
      console.log('⚡ FAST PATH: Using H.264 compatible download (720p)');
      finalFilePath = downloadedFilePath;
    }

    convertedFilePath = finalFilePath;

    // Step 3.5: Apply Watermarking (REMOVED PER USER REQUEST)
    // Media files are now always delivered clean.
    // Logic for checking plan type is no longer needed here for watermarking purposes.

    // Get file size
    const fileStats = fs.statSync(convertedFilePath);
    const fileSize = formatFileSize(fileStats.size);
    const filename = finalFilePath.split(/[\\/]/).pop();

    // Step 4: Upload to Supabase Storage
    console.log('☁️  Step 4: Uploading to storage...');
    storageFilePath = await uploadToStorage(convertedFilePath, 'conversions');
    console.log(`   Uploaded to: ${storageFilePath}\n`);

    // Step 5: Generate signed URL
    console.log('🔗 Step 5: Generating download URL...');
    const signedUrl = await generateSignedUrl(storageFilePath, 'conversions', 86400, filename);
    console.log(`   URL generated (valid for 24h)\n`);

    // Step 6: Cleanup local files
    console.log('🧹 Step 6: Cleaning up temp files...');
    deleteLocalFile(downloadedFilePath);
    deleteLocalFile(convertedFilePath);
    console.log(`   Cleanup complete\n`);

    // Step 7: Increment download counter (if authenticated)
    if (req.user) {
      await incrementDownloadCounter(req.user.id);
      console.log(`✅ Download counter incremented for user ${req.user.id}\n`);
    }

    console.log('🎉 Conversion completed successfully!\n');

    // Return success response
    return res.json({
      success: true,
      downloadUrl: signedUrl,
      filename,
      fileSize,
      duration: formatDuration(videoInfo.duration),
      videoInfo: {
        title: videoInfo.title,
        author: videoInfo.author,
        thumbnail: videoInfo.thumbnail
      },
      message: 'Conversion completed successfully'
    });

  } catch (error) {
    console.error('❌ Conversion error:', error);

    // Cleanup on error
    if (downloadedFilePath) deleteLocalFile(downloadedFilePath);
    if (convertedFilePath) deleteLocalFile(convertedFilePath);

    // Return error response
    return res.status(500).json({
      success: false,
      error: error.message || 'Conversion failed',
      code: 'CONVERSION_FAILED'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Linkiz Converter API',
    timestamp: new Date().toISOString()
  });
});

export default router;
