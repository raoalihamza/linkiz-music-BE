import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define storage paths
const publicDownloadsPath = path.join(__dirname, '../../public/downloads');

/**
 * Upload file to local VPS storage (public/downloads)
 * @param {string} filePath - Local file path (from temp/)
 * @param {string} bucket - Ignored (for backwards compatibility)
 * @param {string} destinationPath - Optional custom filename
 * @returns {Promise<string>} - Relative path in storage
 */
export async function uploadToStorage(filePath, bucket = 'conversions', destinationPath = null) {
  try {
    // Ensure public/downloads directory exists
    if (!fs.existsSync(publicDownloadsPath)) {
      fs.mkdirSync(publicDownloadsPath, { recursive: true });
    }

    const filename = path.basename(filePath);
    const storagePath = destinationPath || `${Date.now()}_${filename}`;
    const destPath = path.join(publicDownloadsPath, storagePath);

    console.log(`Moving ${filename} to public/downloads/${storagePath}`);

    // Move file from temp to public/downloads
    fs.renameSync(filePath, destPath);

    console.log('File moved successfully');
    return storagePath; // Return relative path
  } catch (error) {
    console.error('Error in uploadToStorage:', error);
    throw error;
  }
}

/**
 * Generate download URL for file
 * @param {string} filePath - Relative path in public/downloads
 * @param {string} bucket - Ignored
 * @param {number} expiresIn - Ignored (files are available for 60 mins via cron)
 * @param {string|null} downloadName - Ignored
 * @returns {Promise<string>} - Download URL
 */
export async function generateSignedUrl(filePath, bucket = 'conversions', expiresIn = 86400, downloadName = null) {
  try {
    // Construct URL based on environment
    const baseUrl = process.env.API_URL || 'http://localhost:4004';
    // URL-encode the filename to handle special characters (emojis, spaces, hashtags, etc.)
    const encodedFilePath = encodeURIComponent(filePath);
    const downloadUrl = `${baseUrl}/downloads/${encodedFilePath}`;
    
    console.log(`Generated download URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (error) {
    console.error('Error in generateSignedUrl:', error);
    throw error;
  }
}

/**
 * Delete file from local storage
 * @param {string} filePath - Relative path in public/downloads
 * @param {string} bucket - Ignored
 */
export async function deleteFromStorage(filePath, bucket = 'conversions') {
  try {
    const fullPath = path.join(publicDownloadsPath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`Deleted file from storage: ${filePath}`);
    }
  } catch (error) {
    console.error('Error in deleteFromStorage:', error);
    // Don't throw - cleanup failure shouldn't break the flow
  }
}

/**
 * Delete local file (temp files)
 * @param {string} filePath - Local file path
 */
export function deleteLocalFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted local file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting local file ${filePath}:`, error);
    // Don't throw - cleanup failure shouldn't break the flow
  }
}

/**
 * Delete old files from public/downloads (for cron job)
 * @param {number} maxAgeMinutes - Max age in minutes (default: 60)
 */
export async function deleteOldDownloads(maxAgeMinutes = 60) {
  try {
    if (!fs.existsSync(publicDownloadsPath)) {
      return;
    }

    const files = fs.readdirSync(publicDownloadsPath);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(publicDownloadsPath, file);
      const stats = fs.statSync(filePath);
      const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

      if (ageMinutes > maxAgeMinutes) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted old download: ${file} (age: ${ageMinutes.toFixed(1)} mins)`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Cleanup: Deleted ${deletedCount} old downloads`);
    }
  } catch (error) {
    console.error('Error in deleteOldDownloads:', error);
  }
}
