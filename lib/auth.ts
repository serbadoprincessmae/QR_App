import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

/** Public registration can only create student accounts. Privileged roles must
 * be assigned through a trusted administrator workflow, never from the client. */
export type SignUpProfile = {
  full_name: string;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
const listeners = new Set<() => void>();
let initialized = false;

function notify() {
  listeners.forEach((listener) => listener());
}

export function setAuth(session: Session | null) {
  if (
    !globalLoading &&
    globalSession?.access_token === session?.access_token &&
    globalSession?.refresh_token === session?.refresh_token &&
    globalUser?.id === session?.user.id
  ) {
    return;
  }

  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

function initializeAuth() {
  if (initialized) return;
  initialized = true;

  // Restore an existing session when the app starts, and track later changes.
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.warn('Unable to restore auth session:', error.message);
    setAuth(data.session ?? null);
  }).catch((error) => {
    console.warn('Unable to restore auth session:', error);
    setAuth(null);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuth(session);
  });
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    initializeAuth();
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: profile?.full_name?.trim() ?? '' },
    },
  });

  // The database trigger creates profiles with role='student'. Do not update
  // role from client-provided registration data.
  if (!error && data.user && profile?.full_name?.trim()) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name.trim() })
      .eq('id', data.user.id);

    if (profileError) {
      console.warn('Account created but profile name was not saved:', profileError.message);
    }
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Unable to load user role:', error.message);
    return null;
  }
  if (!data) return null;
  return data.role;
}
