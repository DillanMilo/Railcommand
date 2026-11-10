import { MOBILE_SPEC_SECTIONS, validateRecordDraft, type MobileProject, type MobileRecordDraft, type MobileRecordFormOptions, type MobileRecordKind } from '@railcommand/domain';
import * as Crypto from 'expo-crypto';
import { MobileApiError } from '@railcommand/api-client';
import { router, useNavigation } from 'expo-router';
// Expo Router 57 vendors React Navigation. Use its own context, not a second
// separately installed navigation package. Recheck this adapter on SDK upgrades.
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Field, Screen, StatusBanner } from './ui';
import { BreadcrumbRow, ModuleHeading, WebActionButton, WebHeader } from './web-shell';
import { FormChoice } from './form-choice';
import { mobileApiForUser } from '@/lib/api';
import { captureOfflineScope } from '@/lib/storage-scope';
import { useAuth } from '@/providers/auth-provider';
import { recordDraftStore } from '@/lib/offline-store';
import { cleanFormOptions, createDraftWriter } from '@/lib/record-drafts';
import { colors, fonts } from '@/theme';

const priorities = ['critical', 'high', 'medium', 'low'].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
const specSections = MOBILE_SPEC_SECTIONS.map((id) => ({ id, name: id }));
const localDate = (offset: number) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
async function deadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Could not confirm the request. Your draft is kept; retry with this same draft.')), 20_000); })]); }
  finally { clearTimeout(timer); }
}

export function RecordCreateScreen({ userId, project, kind, online, canCreate }: {
  userId: string; project: MobileProject; kind: MobileRecordKind; online: boolean; canCreate: boolean;
}) {
  const navigation = useNavigation();
  const { sessionRevision, isSessionCurrent } = useAuth();
  const [draft, setDraft] = useState<MobileRecordDraft | null>(null);
  const draftRef = useRef<MobileRecordDraft | null>(null);
  const [options, setOptions] = useState<MobileRecordFormOptions | null>(null);
  const [status, setStatus] = useState('Opening saved draft…');
  const [choiceStatus, setChoiceStatus] = useState('Loading project choices…');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const offlineCurrent = useRef(captureOfflineScope(userId));
  const isCurrent = useCallback(() => alive.current && offlineCurrent.current()
    && isSessionCurrent(userId, sessionRevision), [isSessionCurrent, sessionRevision, userId]);
  const revision = useRef(0);
  const writerRef = useRef<ReturnType<typeof createDraftWriter> | null>(null);
  const writer = useCallback(async (value: MobileRecordDraft) => {
    writerRef.current ??= createDraftWriter((snapshot) => recordDraftStore.save(userId, snapshot, isCurrent));
    await writerRef.current(value);
  }, [isCurrent, userId]);
  const [retry, setRetry] = useState(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const label = kind === 'rfis' ? 'RFI' : 'Submittal';
  const projectId = project.id;
  const list = kind === 'rfis' ? '/(tabs)/rfis' : '/(tabs)/submittals';
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    let current = true;
    setLoadFailed(false);
    const currentRead = () => current && isCurrent();
    void recordDraftStore.read(userId, kind, projectId, currentRead).then((saved) => {
      if (!currentRead()) return;
      const value: MobileRecordDraft = saved ?? { version: 1, kind, projectId, clientId: Crypto.randomUUID(), title: '', body: '', priority: 'medium',
        assignedTo: '', dueDate: kind === 'submittals' ? localDate(14) : '', milestoneId: '', specSection: '', updatedAt: new Date().toISOString() };
      draftRef.current = value; setDraft(value); setStatus(saved ? saved.createdId ? 'Created on server. Open the record below.' : 'Saved on this device' : 'New draft — start entering details');
    }).catch(() => { if (currentRead()) { setLoadFailed(true); setStatus('Could not open the saved draft. Nothing was deleted. Check device storage and retry.'); } });
    return () => { current = false; };
  }, [isCurrent, kind, loadRetry, projectId, userId]);

  useEffect(() => {
    let current = true;
    const currentRead = () => current && isCurrent();
    void (async () => {
      try {
        const cached = await recordDraftStore.readOptions(userId, kind, projectId, currentRead);
        if (!currentRead()) return;
        setOptions(cached); setChoiceStatus(cached ? 'Saved project choices; access is checked again when creating.' : 'No saved project choices. Reconnect to load assignees and milestones.');
        if (!online || !canCreate) return;
        const next = cleanFormOptions(await deadline(mobileApiForUser(userId, currentRead).getRecordFormOptions(kind, projectId)), kind, projectId);
        if (!currentRead()) return;
        if (!next) throw new Error('Invalid choices');
        setOptions(next); setChoiceStatus('Project choices up to date');
        await recordDraftStore.saveOptions(userId, next, currentRead);
      } catch { if (currentRead()) setChoiceStatus('Could not refresh project choices. Saved selections and your draft are unchanged.'); }
    })();
    return () => { current = false; };
    // A user-requested retry intentionally reloads the choices.
  }, [canCreate, isCurrent, kind, online, projectId, retry, userId]);

  const persist = useCallback(async (value: MobileRecordDraft) => {
    const currentRevision = revision.current;
    await writer(value);
    if (isCurrent() && revision.current === currentRevision) { setDirty(false); setStatus('Saved on this device'); }
  }, [isCurrent, writer]);
  const patch = (values: Partial<MobileRecordDraft>) => {
    const current = draftRef.current;
    if (!isCurrent() || !current || current.createdId || inFlight.current) return;
    const next = { ...current, ...values, updatedAt: new Date().toISOString() };
    revision.current += 1; draftRef.current = next; setDraft(next); setDirty(true); setStatus('Saving on this device…');
    const patchRevision = revision.current;
    void persist(next).catch(() => { if (isCurrent() && revision.current === patchRevision) setStatus('Not saved — device storage could not be written. Keep this screen open and retry Save draft.'); });
  };
  usePreventRemove(dirty || busy, ({ data }) => {
    if (inFlight.current) { Alert.alert('Creation is in progress', 'Wait for confirmation before leaving. Your draft remains on this device.'); return; }
    const value = draftRef.current;
    if (!value) return;
    void persist(value).then(() => { if (isCurrent()) navigation.dispatch(data.action); })
      .catch(() => { if (isCurrent()) Alert.alert('Draft not saved', 'The screen was kept open to protect your input. Check storage and retry Save draft.'); });
  });
  const saveAndBack = async () => {
    if (inFlight.current || !draftRef.current) return;
    try { await persist(draftRef.current); if (isCurrent()) router.replace(list); }
    catch { if (isCurrent()) setStatus('Not saved. Keep this screen open and check device storage.'); }
  };
  const openCreated = async (value: MobileRecordDraft) => {
    try { await recordDraftStore.removeCreated(userId, value, isCurrent); } catch { /* Receipt remains reopenable; never replay creation. */ }
    if (isCurrent()) router.replace({ pathname: '/record/[kind]/[id]', params: { kind, id: value.createdId ?? value.clientId, projectId } });
  };
  const submit = async () => {
    const current = draftRef.current;
    if (!isCurrent() || !current || inFlight.current || current.createdId) return;
    if (!online || !canCreate) { setStatus('Creation is online-only and requires current project permission. Your draft can stay on this device.'); return; }
    const error = validateRecordDraft(current);
    if (error) { setStatus(error); return; }
    inFlight.current = true; setBusy(true);
    try {
      await persist(current); if (!isCurrent()) return;
      setStatus(`Creating ${label}…`);
      const result = await deadline(mobileApiForUser(userId, isCurrent).createRecord(current));
      if (!isCurrent()) return;
      if (result.id !== current.clientId || result.projectId !== projectId || result.kind !== kind) throw new Error('Creation receipt could not be verified. Keep this draft and retry.');
      const completed = { ...current, createdId: result.id };
      draftRef.current = completed; setDraft(completed); setDirty(false);
      try { await writer(completed); if (isCurrent()) setStatus(`${result.number} created. Open the record below.`); }
      catch { if (isCurrent()) setStatus(`${result.number} created, but the local receipt could not be saved. Open the record below; do not start another draft for this work.`); }
    } catch (error) { if (isCurrent()) {
      setConflicted(error instanceof MobileApiError && error.status === 409);
      setStatus(error instanceof Error ? error.message : 'Could not confirm creation. Your draft was kept; retry with this same draft.');
    } }
    finally { inFlight.current = false; if (isCurrent()) setBusy(false); }
  };

  return <Screen>
    <WebHeader projectName={project.name} online={online} navigationDisabled={dirty || busy} />
    <BreadcrumbRow current={`New ${label}`} />
    <ModuleHeading title={`New ${label}`} />
    <StatusBanner title={online ? 'Draft and creation status' : 'Offline — draft only'} detail={status} tone={!online || dirty ? 'warning' : 'neutral'} />
    {!canCreate ? <StatusBanner title="Creation permission unavailable" detail="Saved input remains accessible. Refresh project access before submitting; nothing is automatically queued." tone="warning" /> : null}
    {!draft ? loadFailed ? <WebActionButton title="Retry opening saved draft" onPress={() => setLoadRetry((value) => value + 1)} /> : <ActivityIndicator accessibilityLabel="Opening draft" /> : draft.createdId ? <View style={styles.card}>
      <Text style={styles.heading}>{label} created</Text><WebActionButton title="Open created record" primary onPress={() => void openCreated(draft)} />
    </View> : <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{label} Details</Text>
      <Field label={kind === 'rfis' ? 'Subject *' : 'Title *'} value={draft.title} maxLength={300} editable={!busy}
        onChangeText={(title) => patch({ title })} placeholder={kind === 'rfis' ? 'Brief description of the issue' : 'e.g. 136RE Rail — 2,400 LF'} />
      {kind === 'submittals' ? <FormChoice label="Spec Section *" value={draft.specSection} options={specSections} disabled={busy} onChange={(specSection) => patch({ specSection })} /> : null}
      <Field label={kind === 'rfis' ? 'Question *' : 'Description'} value={draft.body} multiline maxLength={50_000} editable={!busy}
        onChangeText={(body) => patch({ body })} placeholder={kind === 'rfis' ? 'Describe the question or information needed in detail…' : 'Describe the submittal materials, quantities, and relevant specs…'} />
      {kind === 'rfis' ? <>
        <FormChoice label="Priority" value={draft.priority} options={priorities} disabled={busy} onChange={(priority) => patch({ priority: priority as MobileRecordDraft['priority'] })} />
        <FormChoice label="Assign To *" value={draft.assignedTo} options={options?.assignees ?? []} disabled={busy} onChange={(assignedTo) => patch({ assignedTo })} />
      </> : null}
      <Field label="Due Date * (YYYY-MM-DD)" value={draft.dueDate} maxLength={10} editable={!busy} autoCapitalize="none" placeholder="YYYY-MM-DD" onChangeText={(dueDate) => patch({ dueDate })} />
      <FormChoice label="Linked Milestone" value={draft.milestoneId} options={options?.milestones ?? []} optional disabled={busy} onChange={(milestoneId) => patch({ milestoneId })} />
      <Text style={styles.muted}>{choiceStatus}</Text>
      <WebActionButton title="Refresh project choices" disabled={!online || busy || !canCreate} onPress={() => setRetry((value) => value + 1)} />
      <StatusBanner title="Attachments not yet available in this form" detail="Photo/file attachment creation still needs native implementation. This step creates the record text only; it does not upload or queue attachments." />
      <WebActionButton title={busy ? 'Creating…' : `Create ${label}`} primary disabled={!online || busy || !canCreate} onPress={() => void submit()} />
      {conflicted ? <WebActionButton title="Review existing record — keep this draft" disabled={busy} onPress={() => {
        void persist(draft).then(() => { if (isCurrent()) router.push({ pathname: '/record/[kind]/[id]', params: { kind, id: draft.clientId, projectId } }); })
          .catch(() => { if (isCurrent()) setStatus('Draft not saved. Keep this screen open and check storage.'); });
      }} /> : null}
      <WebActionButton title="Save draft" disabled={busy} onPress={() => void persist(draft).catch(() => { if (isCurrent()) setStatus('Draft not saved. Keep this screen open and check storage.'); })} />
      <WebActionButton title={`Save draft and return to ${kind === 'rfis' ? 'RFIs' : 'Submittals'}`} disabled={busy} onPress={() => void saveAndBack()} />
      <Text style={styles.muted}>Drafts stay on this device until you explicitly create the record online. They do not synchronize automatically.</Text>
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: 16, borderRadius: 8, gap: 20 },
  heading: { fontFamily: fonts.heading, color: colors.ink, fontSize: 17, lineHeight: 24 },
  muted: { fontFamily: fonts.body, color: colors.muted, fontSize: 12, lineHeight: 19 },
});
