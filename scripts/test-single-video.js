#!/usr/bin/env node

/**
 * Quick test script to check a single YouTube video
 * Usage: node scripts/test-single-video.js <YouTube-URL>
 */

import ytDlp from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const COOKIES_TXT_PATH = path.join(ROOT_DIR, 'cookies.txt');

// Get URL from command line argument or use default
const testUrl = process.argv[2] || 'https://youtu.be/HECUlWMPQPk?si=RQjRbi1w_Aj5Y4Pm';

console.log(`\nTesting video: ${testUrl}\n`);

// Check if cookies exist
if (!fs.existsSync(COOKIES_TXT_PATH)) {
  console.error('❌ cookies.txt not found!');
  console.log('Run: node scripts/refresh-cookies.js');
  process.exit(1);
}

try {
  console.log('Fetching video info with cookies...\n');

  const info = await ytDlp(testUrl, {
    dumpSingleJson: true,
    noWarnings: true,
    cookies: COOKIES_TXT_PATH
  });

  console.log('✅ SUCCESS! Video info retrieved:\n');
  console.log(`Title: ${info.title}`);
  console.log(`Channel: ${info.channel || info.uploader}`);
  console.log(`Duration: ${info.duration ? Math.floor(info.duration / 60) + ':' + (info.duration % 60).toString().padStart(2, '0') : 'Unknown'}`);
  console.log(`View Count: ${info.view_count?.toLocaleString() || 'Unknown'}`);
  console.log(`Upload Date: ${info.upload_date || 'Unknown'}`);
  console.log(`\nAvailability: ${info.availability || 'public'}`);
  console.log(`Age Restricted: ${info.age_limit > 0 ? 'Yes' : 'No'}`);

  // Check available formats
  if (info.formats && info.formats.length > 0) {
    const audioFormats = info.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
    const videoFormats = info.formats.filter(f => f.vcodec !== 'none');

    console.log(`\n📊 Available Formats:`);
    console.log(`   Audio-only formats: ${audioFormats.length}`);
    console.log(`   Video formats: ${videoFormats.length}`);
    console.log(`   Total formats: ${info.formats.length}`);

    // Show best audio format
    if (audioFormats.length > 0) {
      const bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
      console.log(`\n   Best audio: ${bestAudio.format_id} - ${bestAudio.abr}kbps ${bestAudio.acodec}`);
    }

    // Show best video format
    if (videoFormats.length > 0) {
      const bestVideo = videoFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      console.log(`   Best video: ${bestVideo.format_id} - ${bestVideo.height}p ${bestVideo.vcodec}`);
    }
  } else {
    console.log('\n⚠️ WARNING: No formats available!');
  }

  console.log('\n✅ Cookies are working correctly!\n');

} catch (error) {
  console.error('\n❌ ERROR:', error.message);

  if (error.message.includes('Sign in to confirm')) {
    console.error('\n🤖 Bot detection triggered - cookies may need refresh');
  } else if (error.message.includes('Video unavailable')) {
    console.error('\n🚫 Video is unavailable or region-locked');
  } else if (error.message.includes('Requested format is not available')) {
    console.error('\n⚠️ Format not available - video may have restrictions');
  }

  console.log('\nTry with a different video, e.g.:');
  console.log('node scripts/test-single-video.js "https://www.youtube.com/watch?v=jNQXAC9IVRw"');

  process.exit(1);
}
