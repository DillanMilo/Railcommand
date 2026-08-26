'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MobileAccountDeletionResult } from '@railcommand/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listDailyLogDrafts } from '@/lib/offline/daily-log-draft';
import {
  DAILY_LOG_CREATE_OPERATION,
  DAILY_LOG_PHOTO_UPLOAD_OPERATION,
  listOutboxOperations,
} from '@/lib/offline/outbox';
import { clearOfflineDataForUser } from '@/lib/offline/storage';
import { createClient } from '@/lib/supabase/client';

type LocalWork = { drafts: number; outbox: number; photos: number };
const EMPTY_LOCAL_WORK: LocalWork = { drafts: 0, outbox: 0, photos: 0 };

export default function AccountDeletionSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localWork, setLocalWork] = useState<LocalWork>(EMPTY_LOCAL_WORK);
  const [activeRequest, setActiveRequest] = useState<MobileAccountDeletionResult | null>(null);
  const [status, setStatus] = useState('Loading account-deletion status…');
  const [busy, setBusy] = useState(false);

  const inspectLocalWork = useCallback(async (activeUserId: string) => {
    const [drafts, operations] = await Promise.all([
      listDailyLogDrafts(activeUserId),
      listOutboxOperations(activeUserId),
    ]);
    const work = {
      drafts: drafts.length,
      outbox: operations.filter((operation) => operation.kind === DAILY_LOG_CREATE_OPERATION).length,
      photos: operations.filter((operation) => operation.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION).length,
    };
    setLocalWork(work);
    return work;
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace('/login?next=/settings/account-deletion');
        return;
      }
      setUserId(user.id);
      setEmail(user.email);
      try {
        const [work, response] = await Promise.all([
          inspectLocalWork(user.id),
          fetch('/api/account/deletion-request', { cache: 'no-store' }),
        ]);
        if (response.ok) setActiveRequest(await response.json() as MobileAccountDeletionResult | null);
        setStatus(work.drafts + work.outbox + work.photos
          ? 'Review all unsynchronized work before continuing.'
          : 'This browser has no unsynchronized field work.');
      } catch {
        setStatus('RailCommand could not safely inspect this browser. No deletion request was submitted.');
      }
    };
    void load();
  }, [inspectLocalWork, router]);

  const confirmPassword = async (): Promise<boolean> => {
    if (!email || !password) {
      setStatus('Enter your current password to confirm your identity.');
      return false;
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || data.user?.id !== userId) {
      setStatus('The current password could not be confirmed. Nothing was submitted.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!userId || !navigator.onLine) {
      setStatus('Connect to the internet before requesting deletion. Nothing is queued offline.');
      return;
    }
    setBusy(true);
    try {
      const work = await inspectLocalWork(userId);
      if (work.drafts + work.outbox + work.photos > 0) {
        setStatus('Synchronize, reopen, or permanently discard all browser work first.');
        return;
      }
      if (!await confirmPassword()) return;
      const response = await fetch('/api/account/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientRequestId: crypto.randomUUID(), localWork: work }),
      });
      const body = await response.json() as MobileAccountDeletionResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not submit the deletion request.');
      await clearOfflineDataForUser(userId);
      await createClient().auth.signOut({ scope: 'local' }).catch(() => undefined);
      router.replace(`/login?deletion=requested&scheduled=${encodeURIComponent(body.scheduledFor)}`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not submit the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!activeRequest || !navigator.onLine) return;
    setBusy(true);
    try {
      if (!await confirmPassword()) return;
      const response = await fetch('/api/account/deletion-request/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: activeRequest.id }),
      });
      const body = await response.json() as MobileAccountDeletionResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not cancel the request.');
      setActiveRequest(null);
      setPassword('');
      setStatus('Account deletion was canceled. Your account remains active.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not cancel the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  const discardLocalWork = async () => {
    if (!userId) return;
    if (!window.confirm('Permanently discard this browser’s unsynchronized RailCommand work? Server records are not affected.')) return;
    if (!window.confirm('Final confirmation: this local work cannot be recovered.')) return;
    await clearOfflineDataForUser(userId);
    await inspectLocalWork(userId);
    setStatus('Local browser work was permanently discarded. Server records were not changed.');
  };

  const localTotal = localWork.drafts + localWork.outbox + localWork.photos;
  const canCancel = activeRequest?.status === 'pending' || activeRequest?.status === 'reviewing';
  const requestTitle = activeRequest?.status === 'failed'
    ? 'Deletion processing delayed'
    : activeRequest?.status === 'processing'
      ? 'Deletion processing'
      : 'Deletion request pending';
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/settings/profile" className="text-sm font-semibold text-rc-orange hover:underline">← Back to profile</Link>
        <h1 className="font-heading text-3xl font-bold">Delete account</h1>
        <p className="text-muted-foreground">Deletion initiation is online-only and is never silently queued.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{activeRequest ? requestTitle : 'What happens'}</CardTitle>
          <CardDescription>
            {activeRequest
              ? canCancel
                ? `Recovery remains available until ${new Date(activeRequest.scheduledFor).toLocaleDateString()}.`
                : activeRequest.status === 'failed'
                  ? 'RailCommand will retry automatically. Contact support if this state remains visible.'
                  : 'Identity processing has started and the request can no longer be canceled.'
              : 'Review the 30-day recovery period and organization-record treatment.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>Deleted: authentication identity, personal profile fields, sessions, and notification tokens.</p>
          <p>Retained or anonymized: organization-owned construction records and minimum audit history required by contract, legal hold, or applicable law.</p>
          <p>Sole organization administrators must transfer administration or request organization closure before proceeding.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Unsynchronized browser work</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{localWork.drafts} draft(s) · {localWork.outbox} queued log(s) · {localWork.photos} queued photo(s)</p>
          {localTotal > 0 ? <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold hover:bg-muted">Return to Sync Center</Link>
            <Button variant="destructive" onClick={() => void discardLocalWork()}>Permanently discard browser work</Button>
          </div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Confirm your identity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="deletion-password" className="text-sm font-medium">Current password</label>
            <Input id="deletion-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <p role="status" className="text-sm text-muted-foreground">{status}</p>
          {activeRequest && canCancel
            ? <Button disabled={busy || !password} onClick={() => void cancelRequest()}>Cancel deletion request</Button>
            : activeRequest
              ? <p className="text-sm text-muted-foreground">No further action is required in this browser.</p>
            : <Button variant="destructive" disabled={busy || !password || localTotal > 0} onClick={() => void submit()}>Request account deletion</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
