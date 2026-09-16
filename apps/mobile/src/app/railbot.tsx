import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { useAuth } from '@/providers/auth-provider';
import { useMobileData } from '@/providers/mobile-data-provider';
import { readBotDraft, saveBotDraft } from '@/lib/offline-store';
import { botPrompts, createBotStreamParser, newBotDraft, type BotDraft, type BotProposal } from '@/lib/railbot';
import { railbotClient } from '@/lib/railbot-api';
import { mobileConfig } from '@/lib/config';
import { RailBotMessage } from '@/components/railbot-message';
import { colors, fonts } from '@/theme';

type Conversation = { id: string; title: string; updated_at: string };
function Action({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}><Text style={styles.actionText}>{label}</Text></Pressable>;
}
export default function RailBotScreen() {
  const { session, sessionRevision } = useAuth();
  const { activeProjectId } = useMobileData();
  if (!session || !activeProjectId) return <SafeAreaView><Action label="Back" onPress={() => router.back()} /><Text>Select a project to use RailBot.</Text></SafeAreaView>;
  return <ProjectRailBot key={`${sessionRevision}:${activeProjectId}`} userId={session.user.id} projectId={activeProjectId} revision={sessionRevision} />;
}
function ProjectRailBot({ userId, projectId, revision }: { userId: string; projectId: string; revision: number }) {
  const { isSessionCurrent } = useAuth();
  const { online, bootstrap } = useMobileData();
  const [draft, setDraft] = useState<BotDraft>(() => newBotDraft(projectId));
  const ref = useRef(draft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState('Loading saved conversation…');
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const [recording, setRecording] = useState(false);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const saves = useRef(Promise.resolve());
  const scroll = useRef<ScrollView>(null);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const sessionCurrent = useCallback(() => isSessionCurrent(userId, revision), [isSessionCurrent, userId, revision]);
  const current = useCallback(() => alive.current && sessionCurrent(), [sessionCurrent]);
  const api = useMemo(() => railbotClient(userId, current), [userId, current]);
  const projectName = bootstrap?.projects.find(p => p.id === projectId)?.name ?? 'Current project';
  const patch = useCallback((change: Partial<BotDraft>, persist = true) => {
    if (!current()) return Promise.resolve();
    const next = { ...ref.current, ...change }; ref.current = next; setDraft(next);
    if (!persist) return Promise.resolve();
    // Serialize snapshots; navigation may finish the write, but sign-out cannot resurrect it.
    const operation = saves.current.catch(() => undefined).then(() => saveBotDraft(userId, next, sessionCurrent));
    saves.current = operation;
    void operation.catch(() => { if (current()) setStatus('Could not save on this device. Keep this screen open and free storage before leaving.'); });
    return operation;
  }, [current, sessionCurrent, userId]);
  useEffect(() => {
    alive.current = true;
    void readBotDraft(userId, projectId, current).then(saved => {
      if (!current()) return;
      if (saved) { ref.current = saved; setDraft(saved); }
      setReady(true); setStatus('Messages are private to your account.');
    }).catch(() => { if (current()) setStatus('Unable to open the saved draft. It has not been deleted. Reopen RailBot to retry.'); });
    return () => { alive.current = false; abort.current?.abort(); };
  }, [userId, projectId, current]);
  const run = async (work: () => Promise<void>) => {
    if (!ready || busyRef.current || !online || !current()) return;
    busyRef.current = true; setBusy(true);
    try { await work(); } catch (error) { if (current()) setStatus(error instanceof Error ? error.message : 'Request failed. Your draft is retained.'); }
    finally { busyRef.current = false; if (current()) setBusy(false); }
  };
  const loadHistory = () => void run(async () => {
    const response = await api(`/conversations?projectId=${projectId}`);
    const rows = await response.json(); if (current()) setHistory(rows);
  });
  const openConversation = (id: string) => void run(async () => {
    const response = await api(`/conversations/${id}?projectId=${projectId}`);
    const rows = await response.json(); if (!current()) return;
    const messages = rows.filter((m: { role: string }) => ['user','assistant'].includes(m.role));
    const latest = messages.at(-1);
    const call = latest?.tool_calls?.find((t: { mobile_proposal?: boolean }) => t.mobile_proposal === true);
    const proposal = call ? { id: call.id, name: call.function.name, arguments: JSON.parse(call.function.arguments) } : null;
    await patch({ conversationId: id, messages: messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({ role: m.role, content: m.content })), proposal, uncertain: false });
    setHistory(null); setStatus('Conversation loaded. Your unsent text is retained.');
  });
  const consent = (next: () => void) => {
    if (ref.current.aiConsent) { next(); return; }
    Alert.alert('Use RailBot with OpenAI?', 'RailBot sends your messages and relevant project information you can access to OpenAI to generate answers. Voice recordings are sent to OpenAI only when you tap Transcribe. Chat history is stored in your RailCommand account. You can decline and continue using the app.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Allow RailBot', onPress: () => { void patch({ aiConsent: true }).then(next).catch(() => undefined); } },
    ]);
  };
  const send = (text = ref.current.input) => consent(() => { void run(async () => {
    const input = text.trim(); if (!input || recording || ref.current.proposal) return;
    if (ref.current.uncertain) { setStatus('The previous response was interrupted. Open History to check whether it completed before sending again.'); return; }
    const prior = ref.current.messages;
    const messages = [...prior, { role: 'user' as const, content: input }];
    await patch({ input, uncertain: true }); // Persist before starting any network request.
    const controller = new AbortController(); abort.current = controller;
    const response = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, conversationId: ref.current.conversationId, messages: messages.slice(-40) }), signal: controller.signal });
    const reader = response.body?.getReader(); if (!reader) throw new Error('Streaming unavailable. Your message is retained.');
    let content = ''; let done = false; let failed = false; let proposal: BotProposal | null = null;
    const parse = createBotStreamParser(chunk => {
      if (!current()) return;
      if (chunk.type === 'conversation' && typeof chunk.conversationId === 'string') void patch({ conversationId: chunk.conversationId });
      if (chunk.type === 'text') { content += chunk.content ?? ''; void patch({ messages: [...messages, { role: 'assistant', content }] }, false); }
      if (chunk.type === 'proposal') proposal = chunk.proposal;
      if (chunk.type === 'error') { failed = true; setStatus(chunk.error ?? 'RailBot could not finish.'); }
      if (chunk.type === 'done') done = true;
    });
    const decoder = new TextDecoder();
    try {
      while (current()) { const next = await reader.read(); if (next.done) break; parse(decoder.decode(next.value, { stream: true })); }
      parse(decoder.decode() + '\n');
      if (!current()) return;
      if (!done || failed) throw new Error('Response interrupted. Your message is saved; check History before retrying.');
      await patch({ input: '', messages: [...messages, { role: 'assistant', content: content || (proposal ? 'Review the proposed record below.' : 'No response returned.') }], proposal, uncertain: false });
      setStatus(proposal ? 'Nothing has been created. Review the proposal below.' : 'Saved.');
    } finally { reader.releaseLock(); abort.current = null; }
  }); });
  const confirm = () => {
    const proposal = ref.current.proposal; if (!proposal || !ref.current.conversationId) return;
    Alert.alert('Create this live project record?', 'This will create the record shown below in the selected project and make it visible on the web.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Create record', onPress: () => void run(async () => {
        const response = await api('/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, conversationId: ref.current.conversationId, toolId: proposal.id, confirmed: true }) });
        const receipt = await response.json(); if (!current()) return;
        await patch({ proposal: null, messages: [...ref.current.messages, { role: 'assistant', content: `Record created successfully. Reference: ${receipt.id}` }] });
        setStatus('Created and saved to the live project.');
      }) },
    ]);
  };
  const transcribe = () => consent(() => { void run(async () => {
    const uri = ref.current.audioUri; if (!uri) return;
    const audio = new File(uri); if (!audio.exists) throw new Error('Recording unavailable. Your typed message is retained.');
    const form = new FormData(); form.append('audio', { uri, name: 'railbot.m4a', type: 'audio/mp4' } as unknown as Blob);
    const response = await api(`/transcribe?projectId=${projectId}`, { method: 'POST', body: form });
    const result = await response.json(); if (!current()) return;
    const text = `${ref.current.input}${ref.current.input ? '\n' : ''}${result.text ?? ''}`;
    if (text.length > 2000) throw new Error('Transcription exceeds the message limit. Your recording is retained; shorten the typed message before retrying.');
    await patch({ input: text, audioUri: null });
    if (audio.exists) audio.delete();
    setStatus('Dictation added. Review the text before sending.');
  }); });
  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
      if (!current()) { if (recorder.uri) { const f = new File(recorder.uri); if (f.exists) f.delete(); } return; }
      const uri = recorder.uri;
      if (uri) {
        const directory = new Directory(Paths.document, 'railcommand', userId, mobileConfig.profile, 'railbot'); directory.create({ intermediates: true, idempotent: true });
        const source = new File(uri); const target = new File(directory, `${projectId}-${Date.now()}.m4a`); source.move(target);
        await patch({ audioUri: target.uri });
        setStatus('Recording saved. Tap Transcribe when online.');
      }
    } catch { if (current()) setStatus('Recording could not be saved. Keep this screen open and retry.'); }
    finally { if (current()) setRecording(false); void setAudioModeAsync({ allowsRecording: false }); }
  }, [recorder, current, patch, projectId, userId]);
  useEffect(() => {
    if (!recording) return;
    const timer = setTimeout(() => void stopRecording(), 120_000);
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') void stopRecording(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [recording, stopRecording]);
  const startRecording = async () => {
    if (busy || recording || ref.current.audioUri) return;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setStatus('Microphone permission was declined. You can still type.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync(); if (!current()) return;
      if (!recorder.uri) throw new Error('Recording location unavailable');
      await patch({ audioUri: recorder.uri });
      recorder.record(); setRecording(true); setStatus('Recording — tap Stop when finished (maximum 2 minutes).');
    } catch { setStatus('Could not start recording. You can still type.'); }
  };
  const newChat = () => {
    const reset = () => { void patch({ ...newBotDraft(projectId), input: ref.current.input, audioUri: ref.current.audioUri, aiConsent: ref.current.aiConsent }); setHistory(null); setStatus('New chat. Unsent input is retained.'); };
    if (draft.proposal || draft.uncertain) Alert.alert('Start a new chat?', 'The saved conversation remains in History. Any unconfirmed proposal will be left unsubmitted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'New chat', onPress: reset }]); else reset();
  };
  const deleteConversation = (id: string) => Alert.alert('Delete this conversation?', 'This permanently deletes its chat history on mobile and web. Project records are not deleted.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => {
    await api(`/conversations/${id}?projectId=${projectId}`, { method: 'DELETE' }); if (!current()) return;
    setHistory(previous => previous?.filter(row => row.id !== id) ?? null);
    if (ref.current.conversationId === id) await patch({ conversationId: null, messages: [], proposal: null, uncertain: false });
  }) }]);
  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}><Action label="Back" disabled={recording} onPress={() => router.back()} /><View style={styles.titleArea}><Text accessibilityRole="header" style={styles.title}>RailBot</Text><Text style={styles.subtitle}>{projectName}</Text></View><Action label="New chat" disabled={!ready || busy || recording} onPress={newChat} /></View>
      <View style={styles.toolbar}><Text style={styles.subtitle}>{online ? 'Connected · Live project data' : 'Offline · Saved conversation only'}</Text><Action label={history ? 'Close history' : 'History'} disabled={busy || recording || !online} onPress={() => history ? setHistory(null) : loadHistory()} /></View>
      <ScrollView ref={scroll} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (!history) scroll.current?.scrollToEnd({ animated: true }); }}>
        {history ? history.map(row => <View key={row.id} style={styles.bubble}><Action label={row.title} disabled={busy} onPress={() => openConversation(row.id)} /><Action label="Delete conversation" disabled={busy} onPress={() => deleteConversation(row.id)} /></View>) : <>
          {!draft.messages.length && <><Text style={styles.title}>How can I help?</Text><Text style={styles.subtitle}>Ask about project progress, RFIs, submittals, daily logs, punch items, schedules, your team, notifications, or permitted budget information.</Text>{botPrompts.map(prompt => <Action key={prompt} label={prompt} disabled={!online || busy || !ready || Boolean(draft.input)} onPress={() => send(prompt)} />)}</>}
          {draft.messages.map((message, index) => <View key={index} style={[styles.bubble, message.role === 'user' && styles.userBubble]}><Text style={styles.label}>{message.role === 'user' ? 'You' : 'RailBot'}</Text><RailBotMessage text={message.content} /></View>)}
          {draft.proposal && <View style={styles.proposal}><Text style={styles.title}>Review before creating</Text><Text style={styles.message}>{draft.proposal.name.replaceAll('_', ' ')}</Text>{Object.entries(draft.proposal.arguments).map(([key, value]) => <Text key={key} selectable style={styles.message}>{key.replaceAll('_', ' ')}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>)}<Action label="Create record" disabled={!online || busy} onPress={confirm} /><Action label="Dismiss proposal" disabled={busy} onPress={() => void patch({ proposal: null })} /></View>}
        </>}
      </ScrollView>
      <View style={styles.composer}><Text accessibilityLiveRegion="polite" style={styles.status}>{busy ? 'RailBot is working…' : status}</Text>{!online && <Text style={styles.status}>Replies and history need a connection. Your typed draft is saved on this device.</Text>}
        <TextInput accessibilityLabel="Message RailBot" placeholder="Ask RailBot…" multiline maxLength={2000} editable={ready && !busy && !recording} value={draft.input} onChangeText={input => { void patch({ input }); }} style={styles.input} />
        <View style={styles.toolbar}>{recording ? <Action label="Stop recording" onPress={() => void stopRecording()} /> : draft.audioUri ? <Action label="Transcribe recording" disabled={!online || busy} onPress={transcribe} /> : <Action label="Dictate" disabled={!ready || busy} onPress={() => void startRecording()} />}<Text style={styles.subtitle}>{draft.input.length}/2000</Text><Action label="Send" disabled={!ready || !online || busy || recording || !draft.input.trim() || Boolean(draft.proposal)} onPress={() => send()} /></View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, header: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: colors.line }, titleArea: { flex: 1, paddingHorizontal: 10 }, title: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink }, subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }, action: { minHeight: 44, justifyContent: 'center', padding: 10 }, actionText: { color: colors.orangeText, fontFamily: fonts.bodyMedium, fontSize: 14 }, disabled: { opacity: 0.4 }, messages: { padding: 16, gap: 12 }, bubble: { padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9' }, userBubble: { backgroundColor: '#FFF4E8', marginLeft: 25 }, label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted, marginBottom: 6 }, message: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 }, proposal: { borderWidth: 1, borderColor: colors.orangeText, borderRadius: 12, padding: 14, gap: 8 }, composer: { padding: 12, borderTopWidth: 1, borderColor: colors.line }, input: { minHeight: 48, maxHeight: 130, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, color: colors.ink, fontFamily: fonts.body, fontSize: 16 }, status: { fontSize: 12, color: colors.muted, marginBottom: 8 },
});
