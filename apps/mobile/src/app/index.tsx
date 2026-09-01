import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Panel, Screen, StatePanel, textStyles } from '@/components/ui';
import { palette } from '@/constants/app-theme';
import { appConfig } from '@/lib/config';
import { openExternalUrl } from '@/lib/external-links';
import { signInWithGoogle } from '@/lib/oauth';
import { useAuth } from '@/providers/auth-provider';

export default function WelcomeScreen() {
  const { configured, loading, session, error: authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <Screen>
        <StatePanel busy title="Opening your spaces" body="Restoring the encrypted device session." />
      </Screen>
    );
  }

  if (session) return <Redirect href="/(tabs)/chat" />;

  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>ALIASPACES MOBILE</Text>
          <Text style={styles.title}>Your personas, close at hand.</Text>
          <Text style={styles.subtitle}>
            Continue conversations, review publication-ready drafts, and read sourced persona briefings.
          </Text>
        </View>

        {!configured ? (
          <StatePanel
            title="Private app setup required"
            body="The app is intentionally missing its Supabase project URL and publishable key. Add them to a private .env file on this development device. Never use a service-role key."
          />
        ) : (
          <Panel style={styles.signInPanel}>
            <Text style={textStyles.heading}>Sign in to your owner account</Text>
            <Text style={textStyles.muted}>
              Google opens its own consent screen. AliaSpaces never asks you to enter a password or MFA code inside the app.
            </Text>
            {error || authError ? <Text style={styles.error}>{error || authError}</Text> : null}
            <ActionButton
              label={busy ? 'Waiting for Google…' : 'Continue with Google'}
              onPress={() => void signIn()}
              disabled={busy}
            />
          </Panel>
        )}

        <Panel tone="warning">
          <Text style={textStyles.label}>Publication safety</Text>
          <Text style={[textStyles.body, styles.safetyCopy]}>
            Mobile review is read-only until its preview contains the exact account, copy, media, placement, visibility, disclosures, time zone, and one-use server receipt. Scheduling and publishing stay in the web command center.
          </Text>
        </Panel>

        <View style={styles.links}>
          <ActionButton
            label="Privacy"
            tone="secondary"
            onPress={() => void openExternalUrl(`${appConfig.webAppUrl}/privacy.html`)}
          />
          <ActionButton
            label="Terms"
            tone="secondary"
            onPress={() => void openExternalUrl(`${appConfig.webAppUrl}/terms.html`)}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingVertical: 36 },
  hero: { paddingHorizontal: 24, marginBottom: 8 },
  kicker: { color: palette.cyan, fontSize: 12, letterSpacing: 2.3, fontWeight: '900' },
  title: { color: palette.ink, fontSize: 42, lineHeight: 47, fontWeight: '900', marginTop: 10, maxWidth: 520 },
  subtitle: { color: palette.muted, fontSize: 17, lineHeight: 25, marginTop: 14, maxWidth: 560 },
  signInPanel: { gap: 14, marginTop: 20 },
  error: { color: palette.danger, fontSize: 14, lineHeight: 20 },
  safetyCopy: { marginTop: 8 },
  links: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 4, paddingHorizontal: 18 },
});
