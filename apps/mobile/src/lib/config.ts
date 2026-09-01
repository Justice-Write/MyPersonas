const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

function validHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export const appConfig = {
  supabaseUrl,
  supabasePublishableKey,
  webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL?.trim() || 'https://mypersonas.online',
};

export const isSupabaseConfigured =
  validHttpsUrl(supabaseUrl) && supabasePublishableKey.length >= 20;
