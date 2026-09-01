import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { appConfig, isSupabaseConfigured } from '@/lib/config';
import { chunkedSecureStore } from '@/lib/secure-store';

export const supabase = isSupabaseConfigured
  ? createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
      auth: {
        storage: chunkedSecureStore,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;
