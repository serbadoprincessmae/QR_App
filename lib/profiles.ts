
import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active?: boolean;
};

/**
 * Reads a user's profile.
 * Access is still controlled by Supabase RLS policies.
 */
export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Unable to load profile:', error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return data as Profile;
}

/**
 * Updates the current user's full name only.
 * RLS and database grants must also enforce this restriction.
 */
export async function updateProfile(
  userId: string,
  updates: { full_name?: string }
): Promise<{ error: string | null }> {
  const fullName = updates.full_name?.trim();

  if (fullName === undefined) {
    return { error: 'No profile changes were provided.' };
  }

  if (!fullName) {
    return { error: 'Full name cannot be empty.' };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Please sign in again.' };
  }

  if (user.id !== userId) {
    return { error: 'You can only update your own profile.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return {
      error:
        'Profile was not updated. Check your profile and database permissions.',
    };
  }

  return { error: null };
}

export async function updateManagedProfile(
  userId: string,
  role: Role,
  isActive: boolean,
  fullName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_update_profile', {
    target_user_id: userId,
    new_role: role,
    account_active: isActive,
    new_full_name: fullName.trim() || null,
  });

  if (error) {
    console.error('Unable to update managed profile:', error.message);
    return { error: error.message };
  }

  return { error: null };
}
