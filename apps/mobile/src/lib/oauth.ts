import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Add the private Supabase app configuration first.');

  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'aliaspaces', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('The secure sign-in URL was not returned.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return false;
  if (result.type !== 'success') throw new Error('Sign-in did not return to AliaSpaces.');

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('The sign-in response did not contain a one-time authorization code.');
  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
  return true;
}
