'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBetaAccount } from './actions';
import type { BetaAccountResult } from '@/lib/beta-accounts';
import styles from './client.module.css';

export default function BetaInvitationForm() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [online, setOnline] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [account, setAccount] = useState<BetaAccountResult | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || pending) return;
    setError('');
    setAccount(null);
    setCopyStatus('');
    startTransition(async () => {
      try {
        const result = await createBetaAccount({ email, fullName, workspaceName });
        if ('error' in result) setError(result.error);
        else setAccount(result.account);
      } catch {
        setError('The connection was interrupted. Your fields are still here. Retry with the same email to retrieve its invitation.');
      }
    });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      linkRef.current?.select();
      setCopyStatus('Select and copy the activation link below.');
    }
  }

  function changed() {
    setAccount(null);
    setCopyStatus('');
  }

  return (
    <section id="invite" className="scroll-mt-32 border border-border bg-white p-5 sm:p-6 lg:scroll-mt-20">
      <div className={styles.panelTitleGroup}>
        <p className={styles.eyebrow}>NEW BETA ACCOUNT</p>
        <h2>Invite someone to their own workspace</h2>
        <p>Create a real account with an empty, separate workspace. They choose their password and create their first project.</p>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="beta-email" className="text-sm font-semibold">Email address</label>
            <Input id="beta-email" type="email" required maxLength={254} autoComplete="off" value={email}
              disabled={pending} onChange={e => { setEmail(e.target.value); changed(); }} />
          </div>
          <div className="space-y-2">
            <label htmlFor="beta-name" className="text-sm font-semibold">Name <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input id="beta-name" maxLength={120} value={fullName} disabled={pending}
              onChange={e => { setFullName(e.target.value); changed(); }} />
          </div>
          <div className="space-y-2">
            <label htmlFor="beta-workspace" className="text-sm font-semibold">Workspace name <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input id="beta-workspace" maxLength={120} placeholder="Company or workspace" value={workspaceName} disabled={pending}
              onChange={e => { setWorkspaceName(e.target.value); changed(); }} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Enterprise beta access · No access to existing projects · TestFlight enrollment is separate.</p>
        <p role="status" className="text-sm text-muted-foreground">
          {online ? 'Online access required. Your fields stay on this page if the connection drops.' : 'You are offline. Reconnect to create the invitation; your fields are preserved on this page.'}
        </p>
        <Button type="submit" disabled={!online || pending} className="gap-2 bg-orange-600 text-white hover:bg-orange-700">
          <UserPlus size={16} />{pending ? 'Creating invitation…' : 'Create invitation link'}
        </Button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
      {account && (
        <div className="mt-5 space-y-3 border border-green-200 bg-green-50 p-4">
          <p role="status" className="font-semibold text-green-900">Ready to invite {account.email}</p>
          <p className="text-sm text-green-900">{account.workspaceName} is ready. Share this private, one-time link with the recipient. No email has been sent.</p>
          <label htmlFor="beta-activation-link" className="block text-sm font-semibold">Activation link</label>
          <Input ref={linkRef} id="beta-activation-link" readOnly value={account.activationUrl} onFocus={e => e.target.select()} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => copy(account.activationUrl, 'Activation link')} className="gap-2"><Copy size={16} />Copy link</Button>
            <Button type="button" variant="outline" onClick={() => copy(`Your RailCommand account is ready! Open this link to choose your password: ${account.activationUrl}\nThen sign in at ${new URL(account.activationUrl).origin}/login using ${account.email}, and select New Project to create your first project. You have your own empty workspace.`, 'Invitation message')}>Copy message</Button>
          </div>
          <p className="text-sm text-green-900">If it expires before activation, submit the same email again for a fresh link. Once activated, use sign-in or Forgot password.</p>
          <p aria-live="polite" className="text-sm text-green-900">{copyStatus}</p>
        </div>
      )}
    </section>
  );
}
