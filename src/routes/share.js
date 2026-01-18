import express from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../utils/supabase.js';
import { generateSignedUrl } from '../services/storageService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Helper to sanitize filename
const sanitize = (name) => name.replace(/[^\w\s.-]/g, '');

/**
 * POST /api/share/create
 * Create a password-protected share link for a file
 */
router.post('/create', authMiddleware, async (req, res) => {
  const { filePath, fileName, fileSize, password } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!filePath || !password) {
    return res.status(400).json({ success: false, error: 'File and Password required' });
  }

  try {
    // 1. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 2. Create Record
    const { data, error } = await supabase
      .from('secure_shares')
      .insert({
        user_id: userId,
        file_path: filePath,
        file_name: sanitize(fileName || 'file'),
        file_size: fileSize,
        password_hash: hash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      shareId: data.id,
      shareUrl: `${req.protocol}://${req.get('host')}/secure/${data.id}` // Frontend Route? No, frontend handles routing.
      // Actually we return just the ID or full URL for frontend to display.
    });

  } catch (error) {
    console.error('Share Creation Error:', error);
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

/**
 * POST /api/share/unlock
 * Verify password and return download link
 */
router.post('/unlock', async (req, res) => {
  const { shareId, password } = req.body;

  try {
    // 1. Fetch Record
    const { data: share, error } = await supabase
      .from('secure_shares')
      .select('*')
      .eq('id', shareId)
      .single();

    if (error || !share) {
      return res.status(404).json({ success: false, error: 'Link not found or expired' });
    }

    // 2. Check Expiry
    if (new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Link has expired' });
    }

    // 3. Verify Password
    const isMatch = await bcrypt.compare(password, share.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    // 4. Generate Real Download URL
    // Assumption: Files for sharing are in 'conversions' or 'user-files' bucket.
    // We stored the relative path in file_path.
    // Let's assume 'conversions' bucket for now as that's where Converter.tsx saves things.
    // If we need dynamic buckets, we should store bucket_name in secure_shares table.
    // For now, let's default to 'conversions' but check path prefix if possible or just try.
    
    // NOTE: StorageService `generateSignedUrl` expects path and bucket.
    // We will assume 'conversions' bucket for generated files.
    const signedUrl = await generateSignedUrl(share.file_path, 'conversions', 3600, share.file_name);

    res.json({
      success: true,
      downloadUrl: signedUrl,
      fileName: share.file_name,
      fileSize: share.file_size
    });

  } catch (error) {
    console.error('Unlock Error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

/**
 * GET /api/share/info/:id
 * Get public metadata (filename, size) without password (for the lock screen)
 */
router.get('/info/:id', async (req, res) => {
  const { id } = req.params;
  
  const { data, error } = await supabase
    .from('secure_shares')
    .select('file_name, file_size, expires_at, created_at')
    .eq('id', id)
    .single();

  if (error || !data) {
     return res.status(404).json({ success: false, error: 'Link not found' });
  }

  res.json({
    success: true,
    data
  });
});

export default router;
