import cron from 'node-cron';
import { deleteOldDownloads } from './storageService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Delete old files from temp/ directory (Smart Cache cleanup)
 * @param {number} maxAgeMinutes - Max age in minutes
 */
async function deleteOldTempFiles(maxAgeMinutes = 30) {
  try {
    const tempPath = path.join(__dirname, '../../temp');
    
    if (!fs.existsSync(tempPath)) {
      return;
    }

    const files = fs.readdirSync(tempPath);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempPath, file);
      const stats = fs.statSync(filePath);
      const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

      if (ageMinutes > maxAgeMinutes) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted old temp file: ${file} (age: ${ageMinutes.toFixed(1)} mins)`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Temp Cleanup: Deleted ${deletedCount} cache files`);
    }
  } catch (error) {
    console.error('Error in deleteOldTempFiles:', error);
  }
}

/**
 * Start cleanup jobs
 * - Every 10 minutes: Clean public/downloads (60 min retention)
 * - Every 10 minutes: Clean temp/ (30 min retention)
 */
export const startCleanupJob = () => {
  // Run cleanup every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('🧹 [Cron] Starting cleanup...');
    try {
      // Clean final downloads (60 min retention)
      await deleteOldDownloads(60);
      
      // Clean temp cache (30 min retention for smart caching)
      await deleteOldTempFiles(30);
      
    } catch (error) {
      console.error('❌ [Cron] Unexpected error during cleanup:', error);
    }
  });

  console.log('⏰ Cleanup cron job scheduled (runs every 10 minutes).');
};
