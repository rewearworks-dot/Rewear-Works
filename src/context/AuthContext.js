'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logout as logoutAction } from '@/lib/actions/auth';

const AuthContext = createContext();

export function AuthProvider({ children, initialUser = null, initialProfile = null }) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(false);

  // Listener: sinkron (jangan await Supabase di dalam callback).
  // Cukup set user; profil di-fetch oleh effect kedua di bawah.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-fetch profil setiap kali id user berubah
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles').select('id, full_name, phone, role, created_at')
        .eq('id', uid).maybeSingle();
      if (active) setProfile(data ?? null);
    })();
    return () => { active = false; };
  }, [uid]);

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles').select('id, full_name, phone, role, created_at')
      .eq('id', uid).maybeSingle();
    setProfile(data ?? null);
  }, [uid]);

  const value = {
    currentUser: user
      ? { ...user, ...profile, name: profile?.full_name, createdAt: profile?.created_at ?? user.created_at }
      : null,
    profile,
    isLoggedIn: !!user,
    isAdmin: profile?.role === 'admin',
    isCustomer: profile?.role === 'customer',
    isLoading,
    logout: async () => { await logoutAction(); },
    refreshProfile,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
