import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role (for storage operations)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper to verify JWT tokens from frontend
export async function verifySupabaseToken(token) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) throw error;
    return user;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
