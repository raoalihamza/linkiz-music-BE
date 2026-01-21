#!/usr/bin/env node

/**
 * Debug script to test direct yt-dlp download
 */

import ytDlp from 'yt-dlp-exec';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const COOKIES_TXT_PATH = path.join(ROOT_DIR, 'cookies.txt');

const testUrl = process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

console.log('\n=== YT-DLP Debug Download ===\n');
console.log(`URL: ${testUrl}`);
console.log(`Cookies: ${COOKIES_TXT_PATH}`);

// Check yt-dlp version
try {
  const version = await ytDlp('--version');
  console.log(`yt-dlp version: ${version.trim()}`);
} catch (e) {
  console.log('Could not get yt-dlp version');
}

// Test 1: Get formats without cookies
console.log('\n--- Test 1: List formats WITHOUT cookies ---');
try {
  const formats = await ytDlp(testUrl, {
    listFormats: true,
  });
  console.log('SUCCESS - Formats available without cookies');
  console.log(formats.substring(0, 500) + '...');
} catch (e) {
  console.log('FAILED:', e.message.substring(0, 200));
}

// Test 2: Get formats WITH cookies
console.log('\n--- Test 2: List formats WITH cookies ---');
try {
  const formats = await ytDlp(testUrl, {
    listFormats: true,
    cookies: COOKIES_TXT_PATH,
  });
  console.log('SUCCESS - Formats available with cookies');
  console.log(formats.substring(0, 500) + '...');
} catch (e) {
  console.log('FAILED:', e.message.substring(0, 200));
}

// Test 3: Try simple download with bestaudio
console.log('\n--- Test 3: Download bestaudio (5 second timeout) ---');
const outputPath = path.join(ROOT_DIR, 'temp', 'debug_test.%(ext)s');
try {
  // Use a timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.log('Download taking too long, checking partial result...');
  }, 30000);

  await ytDlp(testUrl, {
    output: outputPath,
    format: 'bestaudio',
    cookies: COOKIES_TXT_PATH,
    noPlaylist: true,
  });

  clearTimeout(timeoutId);
  console.log('SUCCESS - Download completed!');
} catch (e) {
  if (e.message.includes('403')) {
    console.log('FAILED with 403 Forbidden - YouTube is blocking downloads');
    console.log('\nThis is NOT a cookie issue - YouTube is blocking based on:');
    console.log('  1. IP address rate limiting');
    console.log('  2. Automated download detection');
    console.log('  3. Geographic restrictions');
  } else if (e.message.includes('format')) {
    console.log('FAILED - Format not available:', e.message.substring(0, 200));
  } else {
    console.log('FAILED:', e.message.substring(0, 300));
  }
}

// Test 4: Try without cookies at all
console.log('\n--- Test 4: Download WITHOUT cookies ---');
try {
  await ytDlp(testUrl, {
    output: path.join(ROOT_DIR, 'temp', 'debug_nocookie.%(ext)s'),
    format: 'bestaudio',
    noPlaylist: true,
  });
  console.log('SUCCESS - Download works WITHOUT cookies!');
} catch (e) {
  if (e.message.includes('403')) {
    console.log('FAILED with 403 - Same error without cookies');
    console.log('This means the issue is NOT cookie-related');
  } else {
    console.log('FAILED:', e.message.substring(0, 200));
  }
}

console.log('\n=== Debug Complete ===\n');
