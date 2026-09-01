import { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { appConfig } from '@/lib/config';
import { openExternalUrl } from '@/lib/external-links';
import { supabase } from '@/lib/supabase';
import { palette, radius } from '@/constants/app-theme';

export function Screen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const signOut = () => {
    Alert.alert('Sign out of this device?', 'Your personas and work stay in your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void supabase?.auth.signOut(),
      },
    ]);
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>ALIASPACES</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open the web command center"
          onPress={() => void openExternalUrl(`${appConfig.webAppUrl}/#/owner`)}
          style={styles.iconButton}>
          <Text style={styles.iconButtonText}>Web</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={signOut}
          style={styles.iconButton}>
          <Text style={styles.iconButtonText}>Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Panel({
  children,
  tone = 'default',
  style,
}: PropsWithChildren<{
  tone?: 'default' | 'warning' | 'danger' | 'success';
  style?: StyleProp<ViewStyle>;
}>) {
  return <View style={[styles.panel, toneStyles[tone], style]}>{children}</View>;
}

export function StatePanel({
  title,
  body,
  busy,
  action,
}: {
  title: string;
  body: string;
  busy?: boolean;
  action?: ReactNode;
}) {
  return (
    <Panel style={styles.statePanel}>
      {busy ? <ActivityIndicator color={palette.cyan} /> : null}
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action}
    </Panel>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled,
  tone = 'primary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        actionStyles[tone],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.actionText, tone === 'secondary' && styles.secondaryActionText]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <View style={[styles.pill, pillStyles[tone]]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export const textStyles = StyleSheet.create({
  body: { color: palette.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heading: { color: palette.ink, fontSize: 20, fontWeight: '800' },
});

const toneStyles = StyleSheet.create({
  default: {},
  warning: { borderColor: '#765F24', backgroundColor: '#271F0C' },
  danger: { borderColor: '#763849', backgroundColor: '#2A1018' },
  success: { borderColor: '#226349', backgroundColor: '#0D281E' },
});

const actionStyles = StyleSheet.create({
  primary: { backgroundColor: palette.blue },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border },
  danger: { backgroundColor: '#7D2940' },
});

const pillStyles = StyleSheet.create({
  default: { backgroundColor: palette.elevated },
  success: { backgroundColor: '#164733' },
  warning: { backgroundColor: '#4B3B13' },
  danger: { backgroundColor: '#51202D' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  eyebrow: { color: palette.cyan, fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  title: { color: palette.ink, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 3 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  iconButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  iconButtonText: { color: palette.ink, fontWeight: '800', fontSize: 12 },
  panel: { marginHorizontal: 18, marginBottom: 14, padding: 16, borderRadius: radius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  statePanel: { marginTop: 24, alignItems: 'center', gap: 10 },
  panelTitle: { color: palette.ink, fontWeight: '800', fontSize: 18, textAlign: 'center' },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  action: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: palette.white, fontSize: 15, fontWeight: '800' },
  secondaryActionText: { color: palette.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  sectionTitle: { color: palette.ink, fontSize: 16, fontWeight: '800', marginHorizontal: 18, marginTop: 8, marginBottom: 10 },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
});
