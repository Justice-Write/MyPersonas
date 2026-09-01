import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Panel, Pill, Screen, StatePanel, textStyles } from '@/components/ui';
import { palette, radius } from '@/constants/app-theme';
import { openExternalUrl } from '@/lib/external-links';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PersonaName = { id: string; name: string; handle: string };
type Brief = {
  id: string;
  persona_id: string;
  brief_date: string;
  executive_summary: string;
  key_findings: unknown;
  sources: unknown;
  finding_count: number;
  status: string;
  created_at: string;
};
type SourceLink = { label: string; url: string };

function validSourceUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function sourceLinks(value: unknown): SourceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'string') {
      const url = validSourceUrl(item);
      return url ? [{ label: `Source ${index + 1}`, url }] : [];
    }
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const url = validSourceUrl(row.url ?? row.href ?? row.source_url);
    if (!url) return [];
    const label = String(row.title ?? row.name ?? row.label ?? new URL(url).hostname);
    return [{ label, url }];
  });
}

function findings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const text = row.finding ?? row.text ?? row.summary ?? row.title;
    return typeof text === 'string' && text.trim() ? [text.trim()] : [];
  });
}

export default function FeedScreen() {
  const { session } = useAuth();
  const [briefs, setBriefs] = useState<Brief[]>([]);
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
    const [briefResult, personaResult] = await Promise.all([
      supabase
        .from('persona_research_briefs')
        .select('id,persona_id,brief_date,executive_summary,key_findings,sources,finding_count,status,created_at')
        .eq('owner', session.user.id)
        .order('brief_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.rpc('my_personas'),
    ]);
    if (epoch !== loadEpoch.current) return;
    if (briefResult.error) setError(briefResult.error.message);
    else setBriefs((briefResult.data ?? []) as Brief[]);
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
      <AppHeader title="Sourced feed" subtitle="Persona research, with links back to evidence" />
      <Panel>
        <Text style={textStyles.label}>Native V1</Text>
        <Text style={[textStyles.body, styles.notice]}>
          This is the existing owner-only research briefing stream. It does not invent a finished public feed or hide missing citations. A dedicated ranked feed pipeline remains a later backend release.
        </Text>
      </Panel>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <StatePanel busy title="Loading briefings" body="Reading current sourced research for your personas." />
      ) : (
        <FlatList
          data={briefs}
          keyExtractor={(brief) => brief.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.cyan} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<StatePanel title="No sourced briefings yet" body="Research must be generated and reviewed in the web command center before it appears here." />}
          renderItem={({ item }) => {
            const persona = personaNames.get(item.persona_id);
            const itemFindings = findings(item.key_findings);
            const itemSources = sourceLinks(item.sources);
            return (
              <Panel style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderCopy}>
                    <Text style={styles.persona}>{persona?.name ?? 'Unknown persona'}</Text>
                    <Text style={styles.date}>{item.brief_date}</Text>
                  </View>
                  <Pill label={item.status.toUpperCase()} tone={item.status === 'reviewed' ? 'success' : 'default'} />
                </View>
                <Text style={styles.summary}>{item.executive_summary || 'No executive summary was stored.'}</Text>

                {itemFindings.length ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Key findings</Text>
                    {itemFindings.map((finding, index) => (
                      <View key={`${item.id}-finding-${index}`} style={styles.findingRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.finding}>{finding}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sources</Text>
                  {itemSources.length ? itemSources.map((source) => (
                    <Pressable
                      key={source.url}
                      accessibilityRole="link"
                      onPress={() => void openExternalUrl(source.url)}
                      style={styles.sourceLink}>
                      <Text style={styles.sourceLabel}>{source.label}</Text>
                      <Text numberOfLines={1} style={styles.sourceUrl}>{source.url}</Text>
                    </Pressable>
                  )) : <Text style={styles.missing}>No valid source links were stored with this briefing.</Text>}
                </View>
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
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardHeaderCopy: { flex: 1 },
  persona: { color: palette.cyan, fontSize: 18, fontWeight: '900' },
  date: { color: palette.muted, fontSize: 12, marginTop: 3 },
  summary: { color: palette.ink, fontSize: 16, lineHeight: 24, marginTop: 14 },
  section: { marginTop: 18 },
  sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  findingRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  bullet: { color: palette.violet, fontSize: 18, lineHeight: 21 },
  finding: { flex: 1, color: palette.ink, fontSize: 14, lineHeight: 21 },
  sourceLink: { padding: 12, borderRadius: radius.small, backgroundColor: '#091728', borderWidth: 1, borderColor: palette.border, marginBottom: 8 },
  sourceLabel: { color: palette.cyan, fontWeight: '800', fontSize: 14 },
  sourceUrl: { color: palette.muted, fontSize: 11, marginTop: 4 },
  missing: { color: palette.warning, fontSize: 13, lineHeight: 19 },
});
