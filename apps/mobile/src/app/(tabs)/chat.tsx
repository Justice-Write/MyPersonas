import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton, AppHeader, Screen, StatePanel } from '@/components/ui';
import { palette, radius } from '@/constants/app-theme';
import { appConfig } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Persona = {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  ai_backend: string | null;
};

type Workspace = {
  id: string;
  persona_id: string;
  title: string;
  pinned: boolean;
  conversation_key: string;
  updated_at: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  client_message_id: string | null;
  created_at: string;
};

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  return 'The request could not be completed.';
}

export default function ChatScreen() {
  const { session } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaId, setPersonaId] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [workspaceTitle, setWorkspaceTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const personaIdRef = useRef('');
  const workspaceIdRef = useRef('');

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === personaId) ?? null,
    [personaId, personas],
  );
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, workspaces],
  );

  const loadPersonas = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setError('');
    const result = await supabase.rpc('my_personas');
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    const rows = (result.data ?? []) as Persona[];
    setPersonas(rows);
    setPersonaId((current) => {
      const next = rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '';
      personaIdRef.current = next;
      return next;
    });
    setLoading(false);
  }, [session]);

  const loadWorkspaces = useCallback(async () => {
    if (!supabase || !session || !personaId) {
      setWorkspaces([]);
      workspaceIdRef.current = '';
      setWorkspaceId('');
      return;
    }
    const requestedPersona = personaId;
    const result = await supabase
      .from('chat_workspaces')
      .select('id,persona_id,title,pinned,conversation_key,updated_at')
      .eq('owner', session.user.id)
      .eq('persona_id', requestedPersona)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (requestedPersona !== personaIdRef.current) return;
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const rows = (result.data ?? []) as Workspace[];
    setWorkspaces(rows);
    setWorkspaceId((current) => {
      const next = rows.some((row) => row.id === current) ? current : rows[0]?.id ?? '';
      workspaceIdRef.current = next;
      return next;
    });
  }, [personaId, session]);

  const loadMessages = useCallback(async () => {
    if (!supabase || !session || !selectedWorkspace) {
      setMessages([]);
      return;
    }
    const requestedWorkspace = selectedWorkspace.id;
    const result = await supabase
      .from('agent_messages')
      .select('role,content,client_message_id,created_at')
      .eq('owner', session.user.id)
      .eq('workspace_id', requestedWorkspace)
      .order('created_at', { ascending: false })
      .limit(200);
    if (requestedWorkspace !== workspaceIdRef.current) return;
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const rows = (result.data ?? []) as Message[];
    setMessages(rows.reverse());
  }, [selectedWorkspace, session]);

  useEffect(() => {
    const timer = setTimeout(() => void loadPersonas(), 0);
    return () => clearTimeout(timer);
  }, [loadPersonas]);

  useEffect(() => {
    const timer = setTimeout(() => void loadWorkspaces(), 0);
    return () => clearTimeout(timer);
  }, [loadWorkspaces]);

  useEffect(() => {
    const timer = setTimeout(() => void loadMessages(), 0);
    return () => clearTimeout(timer);
  }, [loadMessages]);

  const createWorkspace = async () => {
    if (!supabase || !session || !selectedPersona) return;
    const title = workspaceTitle.replace(/\s+/g, ' ').trim();
    if (!title || title.length > 200) {
      setError('Enter a workspace title between 1 and 200 characters.');
      return;
    }
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    const result = await supabase.from('chat_workspaces').insert({
      id,
      owner: session.user.id,
      persona_id: selectedPersona.id,
      title,
      pinned: false,
      conversation_key: `workspace:${id}`,
      created_at: now,
      updated_at: now,
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setWorkspaceTitle('');
    await loadWorkspaces();
    workspaceIdRef.current = id;
    setWorkspaceId(id);
  };

  const performSend = async () => {
    if (!supabase || !session || !selectedPersona || !selectedWorkspace) return;
    const content = draft.trim();
    if (!content || content.length > 20000) {
      setError('Enter a message between 1 and 20,000 characters.');
      return;
    }
    if (!selectedPersona.ai_backend) {
      setError('This persona does not have a linked AI text model. Add one in the web command center.');
      return;
    }

    setSending(true);
    setError('');
    const userMessage: Message = {
      role: 'user',
      content,
      client_message_id: Crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setDraft('');
    setMessages((current) => [...current, userMessage]);

    try {
      const appendUser = await supabase.rpc('append_agent_messages', {
        p_messages: [
          {
            persona_id: selectedPersona.id,
            workspace_id: selectedWorkspace.id,
            conversation_key: selectedWorkspace.conversation_key,
            client_message_id: userMessage.client_message_id,
            role: userMessage.role,
            content: userMessage.content,
          },
        ],
      });
      if (appendUser.error) throw appendUser.error;

      const sessionResult = await supabase.auth.getSession();
      const activeSession = sessionResult.data.session;
      if (!activeSession || activeSession.user.id !== session.user.id) {
        throw new Error('Your signed-in account changed. The saved message was not sent to a model.');
      }
      const context = [...messages, userMessage]
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-36)
        .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
      const response = await fetch(`${appConfig.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`,
        },
        body: JSON.stringify({
          action: 'chat',
          backendId: selectedPersona.ai_backend,
          personaId: selectedPersona.id,
          mode: 'owner_chat',
          max_tokens: 2500,
          messages: context,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { content?: string; error?: string | { message?: string } };
      if (!response.ok || !payload.content) {
        const detail = typeof payload.error === 'string' ? payload.error : payload.error?.message;
        throw new Error(detail || `The secure AI service returned HTTP ${response.status}.`);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: payload.content,
        client_message_id: Crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      const appendAssistant = await supabase.rpc('append_agent_messages', {
        p_messages: [
          {
            persona_id: selectedPersona.id,
            workspace_id: selectedWorkspace.id,
            conversation_key: selectedWorkspace.conversation_key,
            client_message_id: assistantMessage.client_message_id,
            role: assistantMessage.role,
            content: assistantMessage.content,
          },
        ],
      });
      if (appendAssistant.error) throw appendAssistant.error;
      if (
        personaIdRef.current === selectedPersona.id &&
        workspaceIdRef.current === selectedWorkspace.id
      ) {
        setMessages((current) => [...current, assistantMessage]);
      }
      await supabase
        .from('chat_workspaces')
        .update({ updated_at: assistantMessage.created_at })
        .eq('owner', session.user.id)
        .eq('id', selectedWorkspace.id);
    } catch (cause) {
      setError(errorMessage(cause));
      if (workspaceIdRef.current === selectedWorkspace.id) await loadMessages();
    } finally {
      setSending(false);
    }
  };

  const confirmSend = () => {
    Alert.alert(
      `Send to ${selectedPersona?.name ?? 'this persona'}?`,
      'This saves the message to your workspace and may use billing on the AI model connected to this persona.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => void performSend() },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Persona chat" />
        <StatePanel busy title="Loading your personas" body="Reading only the personas owned by this account." />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader title="Persona chat" subtitle="Resumable, owner-only workspaces" />

        {personas.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
            {personas.map((persona) => (
              <Pressable
                key={persona.id}
                accessibilityRole="button"
                accessibilityState={{ selected: persona.id === personaId }}
                onPress={() => {
                  personaIdRef.current = persona.id;
                  workspaceIdRef.current = '';
                  setPersonaId(persona.id);
                  setWorkspaceId('');
                  setMessages([]);
                }}
                style={[styles.chip, persona.id === personaId && styles.chipSelected]}>
                <Text style={[styles.chipText, persona.id === personaId && styles.chipTextSelected]}>
                  {persona.name}
                </Text>
                <Text style={styles.handle}>@{persona.handle}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!personas.length ? (
          <StatePanel title="No owned personas yet" body="Create your first persona in the web command center, then refresh here." action={<ActionButton label="Refresh" onPress={() => void loadPersonas()} />} />
        ) : (
          <>
            <View style={styles.workspaceComposer}>
              <TextInput
                accessibilityLabel="New workspace title"
                value={workspaceTitle}
                onChangeText={setWorkspaceTitle}
                maxLength={200}
                placeholder="New workspace title"
                placeholderTextColor={palette.muted}
                style={styles.workspaceInput}
              />
              <ActionButton label="Create" onPress={() => void createWorkspace()} disabled={!workspaceTitle.trim()} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workspaceRail}>
              {workspaces.map((workspace) => (
                <Pressable
                  key={workspace.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: workspace.id === workspaceId }}
                  onPress={() => {
                    workspaceIdRef.current = workspace.id;
                    setWorkspaceId(workspace.id);
                    setMessages([]);
                  }}
                  style={[styles.workspaceChip, workspace.id === workspaceId && styles.workspaceChipSelected]}>
                  <Text numberOfLines={1} style={styles.workspaceText}>
                    {workspace.pinned ? '★ ' : ''}{workspace.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {selectedWorkspace ? (
              <>
                <FlatList
                  data={messages}
                  keyExtractor={(item, index) => item.client_message_id ?? `${item.created_at}-${index}`}
                  contentContainerStyle={styles.messages}
                  renderItem={({ item }) => (
                    <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.personaMessage]}>
                      <Text style={styles.messageRole}>{item.role === 'user' ? 'YOU' : selectedPersona?.name?.toUpperCase()}</Text>
                      <Text style={styles.messageText}>{item.content}</Text>
                    </View>
                  )}
                  ListEmptyComponent={<Text style={styles.empty}>Start this workspace with a message.</Text>}
                />
                <View style={styles.composer}>
                  <TextInput
                    accessibilityLabel="Message to persona"
                    value={draft}
                    onChangeText={setDraft}
                    editable={!sending}
                    multiline
                    maxLength={20000}
                    placeholder={`Message ${selectedPersona?.name ?? 'persona'}…`}
                    placeholderTextColor={palette.muted}
                    style={styles.messageInput}
                  />
                  <ActionButton label={sending ? 'Sending…' : 'Send'} onPress={confirmSend} disabled={sending || !draft.trim()} />
                </View>
              </>
            ) : (
              <StatePanel title="Create a workspace" body="Each workspace keeps one named, resumable conversation with this persona." />
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRail: { paddingHorizontal: 18, gap: 10, paddingBottom: 10 },
  chip: { minWidth: 120, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.medium, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  chipSelected: { borderColor: palette.cyan, backgroundColor: '#102C43' },
  chipText: { color: palette.ink, fontWeight: '800', fontSize: 14 },
  chipTextSelected: { color: palette.cyan },
  handle: { color: palette.muted, fontSize: 11, marginTop: 2 },
  error: { color: palette.danger, marginHorizontal: 18, marginBottom: 8, fontSize: 13, lineHeight: 18 },
  workspaceComposer: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 8, alignItems: 'center' },
  workspaceInput: { flex: 1, minHeight: 48, color: palette.ink, backgroundColor: palette.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 16 },
  workspaceRail: { paddingHorizontal: 18, gap: 8, paddingBottom: 10 },
  workspaceChip: { maxWidth: 220, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  workspaceChipSelected: { borderColor: palette.violet, backgroundColor: '#231E45' },
  workspaceText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  messages: { flexGrow: 1, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'flex-end', gap: 10 },
  message: { maxWidth: '88%', padding: 13, borderRadius: radius.medium, borderWidth: 1 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#163A68', borderColor: '#2C65A7' },
  personaMessage: { alignSelf: 'flex-start', backgroundColor: palette.surface, borderColor: palette.border },
  messageRole: { color: palette.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  messageText: { color: palette.ink, fontSize: 15, lineHeight: 22 },
  empty: { color: palette.muted, textAlign: 'center', padding: 30 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#091728', borderTopWidth: 1, borderTopColor: palette.border },
  messageInput: { flex: 1, minHeight: 48, maxHeight: 140, color: palette.ink, backgroundColor: palette.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 14, paddingVertical: 12 },
});
