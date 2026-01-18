import { supabase } from '../utils/supabase.js';

/**
 * Quota checking middleware
 * Checks if user has remaining download quota
 */
export async function quotaMiddleware(req, res, next) {
  try {
    // If no user (anonymous), allow conversion (they can download without quota)
    // Quota will be enforced when they try to download from their Linkiz page
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;

    // Get user profile with quota info
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('plan_type, downloads_used, downloads_limit')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check quota',
        code: 'QUOTA_CHECK_FAILED'
      });
    }

    // Check if user has exceeded quota
    if (profile.downloads_used >= profile.downloads_limit) {
      return res.status(403).json({
        success: false,
        error: `Download quota exceeded. You have used ${profile.downloads_used}/${profile.downloads_limit} downloads. Please upgrade your plan.`,
        code: 'QUOTA_EXCEEDED',
        quota: {
          used: profile.downloads_used,
          limit: profile.downloads_limit,
          plan: profile.plan_type
        }
      });
    }

    // Attach quota info to request for later use
    req.userQuota = {
      planType: profile.plan_type,
      downloadsUsed: profile.downloads_used,
      downloadsLimit: profile.downloads_limit
    };

    next();
  } catch (error) {
    console.error('Quota middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check quota',
      code: 'QUOTA_CHECK_FAILED'
    });
  }
}

/**
 * Increment download counter after successful conversion
 */
export async function incrementDownloadCounter(userId) {
  try {
    // Fetch current value
    const { data, error: fetchError } = await supabase
      .from('user_profiles')
      .select('downloads_used')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching download count:', fetchError);
      return;
    }

    // Increment
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        downloads_used: (data.downloads_used || 0) + 1
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error incrementing download counter:', updateError);
    }
  } catch (error) {
    console.error('Error in incrementDownloadCounter:', error);
  }
}
