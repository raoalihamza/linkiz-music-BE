import { supabase } from '../utils/supabase.js';

/**
 * Get full user profile from Supabase DB
 * @param {string} userId 
 */
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  return data;
};
