import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ActionButton, AppHeader, Panel, Pill, Screen, StatePanel, textStyles } from '@/components/ui';
import { palette, radius } from '@/constants/app-theme';
import { appConfig } from '@/lib/config';
import { openExternalUrl } from '@/lib/external-links';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Draft = {
  id: string;
  persona_id: string;
  status: string;
  brief: string | null;
  targets: string[] | null;
  fb_caption: string | null;
  ig_caption: string | null;
  x_caption: string | null;
  fb_image_url: string | null;
  ig_image_url: string | null;
  x_image_url: string | null;
  approved_facebook_page_id: string | null;
  approved_instagram_business_id: string | null;
  approved_timezone: string | null;
  scheduled_for: string | null;
  approved_at: string | null;
  created_at: string;
};

type PersonaName = { id: string; name: string; handle: string };

const targetDetails = {
  facebook: { name: 'Facebook', placement: 'Feed', caption: 'fb_caption', image: 'fb_image_url', destination: 'approved_facebook_page_id' },
  instagram: { name: 'Instagram', placement: 'Feed', caption: 'ig_caption', image: 'ig_image_url', destination: 'approved_instagram_business_id' },
  twitter: { name: 'X', placement: 'Timeline', caption: 'x_caption', image: 'x_image_url', destination: '' },
  x: { name: 'X', placement: 'Timeline', caption: 'x_caption', image: 'x_image_url', destination: '' },
} as const;

type KnownTarget = keyof typeof targetDetails;

function formatDate(value: string | null) {
  if (!value) return 'Not chosen';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function httpUrl(value: string | null) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export default function ApprovalsScreen() {
  const { session } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [personas, setPersonas] = useState<PersonaName[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadEpoch = useRef(0);

  const personaNames = useMemo(
    () => new Map(personas.map((persona) => [persona.id, persona])),
    [personas],
  );

  const load = useCallback(async (refresh = false) => {
    if (!supabase || !session) return;
    const epoch = ++loadEpoch.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const [draftResult, personaResult] = await Promise.all([
      supabase
        .from('post_drafts')
        .select('id,persona_id,status,brief,targets,fb_caption,ig_caption,x_caption,fb_image_url,ig_image_url,x_image_url,approved_facebook_page_id,approved_instagram_business_id,approved_timezone,scheduled_for,approved_at,created_at')
        .eq('owner', session.user.id)
        .not('status', 'in', '(posted,skipped)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.rpc('my_personas'),
    ]);
    if (epoch !== loadEpoch.current) return;
    if (draftResult.error) setError(draftResult.error.message);
    else setDrafts((draftResult.data ?? []) as Draft[]);
    if (personaResult.error) setError((current) => current || personaResult.error.message);
    else setPersonas((personaResult.data ?? []) as PersonaName[]);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      loadEpoch.current += 1;
    };
  }, [load]);

  return (
    <Screen>
      <AppHeader title="Approval inbox" subtitle="Review inventory — no mobile scheduling" />
      <Panel tone="warning">
        <Text style={textStyles.label}>Safety gate is active</Text>
        <Text style={[textStyles.body, styles.notice]}>
          These cards help you inspect drafts. They are not the final action preview because provider visibility, disclosures, exact X destination, and a one-use server receipt are not all frozen here. No Approve, Schedule, Send, or Publish control is exposed.
        </Text>
      </Panel>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <StatePanel busy title="Loading draft inventory" body="Reading owner-scoped drafts without changing their status." />
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(draft) => draft.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.cyan} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<StatePanel title="No drafts need review" body="Nothing is scheduled or published from this screen." />}
          ListFooterComponent={
            drafts.length ? (
              <View style={styles.webAction}>
                <ActionButton
                  label="Open exact web review"
                  onPress={() => void openExternalUrl(`${appConfig.webAppUrl}/#/schedule`)}
                />
                <Text style={styles.footerNote}>
                  The web command center must generate a fresh exact platform preview. Any edit invalidates its acknowledgment.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const persona = personaNames.get(item.persona_id);
            const rawTargets = Array.isArray(item.targets) ? item.targets : [];
            const targets = rawTargets.filter((target): target is KnownTarget => target in targetDetails);
            return (
              <Panel style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderCopy}>
                    <Text style={styles.persona}>{persona?.name ?? 'Unknown persona'}</Text>
                    <Text style={styles.handle}>{persona ? `@${persona.handle}` : item.persona_id}</Text>
                  </View>
                  <Pill label={item.status.toUpperCase()} tone={item.status === 'draft' ? 'warning' : 'default'} />
                </View>
                {item.brief ? <Text style={styles.brief}>{item.brief}</Text> : null}

                {!targets.length ? (
                  <Text style={styles.blocked}>No recognized publication target is selected.</Text>
                ) : (
                  targets.map((target) => {
                    const details = targetDetails[target];
                    const caption = String(item[details.caption] ?? '');
                    const mediaUrl = httpUrl(String(item[details.image] ?? ''));
                    const destination = details.destination ? String(item[details.destination] ?? '') : '';
                    return (
                      <View key={target} style={styles.targetCard}>
                        <View style={styles.targetTitleRow}>
                          <Text style={styles.targetTitle}>{details.name}</Text>
                          <Pill label={destination ? 'TARGET FROZEN' : 'TARGET MISSING'} tone={destination ? 'success' : 'danger'} />
                        </View>
                        <Text style={styles.metaLabel}>Exact destination</Text>
                        <Text style={destination ? styles.metaValue : styles.blocked}>
                          {destination || 'Not frozen in this draft inventory'}
                        </Text>
                        <Text style={styles.metaLabel}>Copy</Text>
                        <Text style={caption ? styles.copy : styles.blocked}>{caption || 'No platform copy'}</Text>
                        <Text style={styles.metaLabel}>Media</Text>
                        {mediaUrl ? (
                          <>
                            <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
                            <Text selectable style={styles.mediaUrl}>{mediaUrl}</Text>
                          </>
                        ) : (
                          <Text style={styles.blocked}>No exact media URL</Text>
                        )}
                        <Text style={styles.metaLabel}>Placement</Text>
                        <Text style={styles.metaValue}>{details.placement}</Text>
                        <Text style={styles.metaLabel}>Visibility and disclosures</Text>
                        <Text style={styles.blocked}>Must be confirmed and frozen by the final web preview</Text>
                        <Text style={styles.metaLabel}>Time and zone</Text>
                        <Text style={styles.metaValue}>{formatDate(item.scheduled_for)} · {item.approved_timezone || 'Zone not chosen'}</Text>
                      </View>
                    );
                  })
                )}
                <Text style={styles.created}>Draft created {formatDate(item.created_at)}</Text>
              </Panel>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: 8 },
  error: { color: palette.danger, marginHorizontal: 18, marginBottom: 8, lineHeight: 19 },
  list: { paddingBottom: 30 },
  card: { padding: 16 },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardHeaderCopy: { flex: 1 },
  persona: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  handle: { color: palette.muted, fontSize: 12, marginTop: 2 },
  brief: { color: palette.ink, fontSize: 15, lineHeight: 22, marginTop: 14 },
  targetCard: { marginTop: 14, padding: 14, borderRadius: radius.medium, backgroundColor: '#091728', borderWidth: 1, borderColor: palette.border },
  targetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  targetTitle: { flex: 1, color: palette.cyan, fontSize: 17, fontWeight: '900' },
  metaLabel: { color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800', fontSize: 10, marginTop: 10, marginBottom: 3 },
  metaValue: { color: palette.ink, fontSize: 13, lineHeight: 19 },
  copy: { color: palette.ink, fontSize: 15, lineHeight: 22 },
  blocked: { color: palette.danger, fontSize: 13, lineHeight: 19 },
  media: { width: '100%', aspectRatio: 1.4, borderRadius: radius.small, backgroundColor: palette.elevated, marginTop: 4 },
  mediaUrl: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 6 },
  created: { color: palette.muted, fontSize: 11, marginTop: 14 },
  webAction: { gap: 10, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 20 },
  footerNote: { color: palette.muted, textAlign: 'center', fontSize: 12, lineHeight: 17 },
});
