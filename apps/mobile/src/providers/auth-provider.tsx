import type { Session } from '@supabase/supabase-js';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured } from '@/lib/config';
import { supabase } from '@/lib/supabase';

type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  error: string;
};

const AuthContext = createContext<AuthState>({
  configured: isSupabaseConfigured,
  loading: true,
  session: null,
  error: '',
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const client = supabase;
    const restore = async () => {
      const result = await client.auth.getSession();
      if (!active) return;
      if (result.error) {
        setError('The saved session could not be restored. Sign in again when you are ready.');
        setSession(null);
      } else {
        setSession(result.data.session);
      }
      setLoading(false);
    };

    void restore();
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setError('');
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo(
    () => ({ configured: isSupabaseConfigured, loading, session, error }),
    [error, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
