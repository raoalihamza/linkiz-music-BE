import { verifySupabaseToken } from '../utils/supabase.js';

/**
 * Authentication middleware
 * Verifies Supabase JWT token from Authorization header
 */
export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Allow anonymous access (optional - check in quota middleware)
    if (!authHeader) {
      req.user = null;
      return next();
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const user = await verifySupabaseToken(token);
    req.user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Don't block request - allow anonymous access
    req.user = null;
    next();
  }
}
