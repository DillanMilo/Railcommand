import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mobile Support',
  description: 'Support resources for the RailCommand mobile application.',
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-rc-paper px-5 py-12 text-foreground">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-rc-border pb-6">
          <Link href="/" className="text-sm font-semibold text-rc-orange hover:underline">RailCommand</Link>
          <h1 className="font-heading text-4xl font-bold">Mobile support</h1>
          <p className="text-muted-foreground">Help for authorized RailCommand organization users in the United States.</p>
        </header>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">Get help</h2>
          <p>
            Email <a className="font-semibold text-rc-orange hover:underline" href="mailto:support@railcommand.io?subject=RailCommand%20mobile%20support">support@railcommand.io</a> with
            your app version, device model, and a short description of the problem. Do not send passwords,
            access tokens, customer photos, or sensitive project records.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">Offline work</h2>
          <p>New daily-log drafts, attached locations, and photos are saved on the device and shown in Sync Center until synchronization finishes. Existing records are read-only while offline.</p>
          <p>If synchronization fails, keep the item on the device and contact support. Do not sign out or discard the item unless you intend to remove that local work permanently.</p>
        </section>
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">Account and privacy</h2>
          <p className="flex flex-col items-start gap-2 sm:flex-row sm:gap-6">
            <Link href="/privacy" className="font-semibold text-rc-orange hover:underline">Privacy policy</Link>
            <Link href="/account-deletion" className="font-semibold text-rc-orange hover:underline">Account deletion</Link>
            <Link href="/terms" className="font-semibold text-rc-orange hover:underline">Terms</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
