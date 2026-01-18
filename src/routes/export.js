import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateTXT, generateCSV } from '../services/exportService.js';
import { getUserProfile } from '../services/userService.js';
import archiver from 'archiver';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiverZipEncrypted = require('archiver-zip-encrypted');

// Register format
archiver.registerFormat('zip-encrypted', archiverZipEncrypted);

const router = express.Router();

/**
 * POST /api/export
 * Export playlist to TXT or CSV
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { tracks, format } = req.body;
    const userId = req.user.id; // From authMiddleware

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks provided for export' });
    }

    // Fetch user plan (DB Call)
    // We assume req.user is populated by authMiddleware, but we might need fresh DB info for plan_type
    const userProfile = await getUserProfile(userId);
    const planType = userProfile?.plan_type || 'free';

    let fileContent = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    console.log(`📤 Exporting ${tracks.length} tracks as ${format} for user ${userId} [Plan: ${planType}]`);

    if (format === 'csv') {
      fileContent = await generateCSV(tracks, planType);
      mimeType = 'text/csv';
      extension = 'csv';
    } else {
      fileContent = generateTXT(tracks, planType);
      mimeType = 'text/plain';
      extension = 'txt';
    }

    const { password } = req.body;

    if (password && password.trim().length > 0) {
      // Create Password Protected ZIP
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="linkiz_playlist_${Date.now()}.zip"`);

      const archive = archiver('zip-encrypted', {
        zlib: { level: 9 },
        encryptionMethod: 'aes256',
        password: password
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(res);
      archive.append(fileContent, { name: `playlist.${extension}` });
      await archive.finalize();
      
    } else {
      // Return file stream directly
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="linkiz_playlist_${Date.now()}.${extension}"`);
      res.send(fileContent);
    }

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ error: 'Failed to generate export file' });
  }
});

export default router;
