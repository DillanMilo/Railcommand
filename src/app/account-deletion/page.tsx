import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Request Account Deletion',
  description: 'Request deletion of a RailCommand account and associated personal data.',
};

export default function AccountDeletionInformationPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        <header className="space-y-3">
          <Link href="/login" className="text-sm font-semibold text-rc-orange hover:underline">
            RailCommand
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Request account deletion</h1>
            <p className="text-muted-foreground">RailCommand by Creative Currents</p>
          </div>
        </header>

        <section className="space-y-5 leading-7 text-muted-foreground">
          <p>
            You can request deletion in the RailCommand mobile app under <strong>Account</strong>,
            or sign in on the web and open account settings. You never need to reinstall the app
            to submit a request.
          </p>
          <div className="rounded-lg border border-rc-border bg-card p-5 space-y-3">
            <h2 className="text-xl font-semibold text-foreground">What happens</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Your request starts a 30-day recovery period.</li>
              <li>Your sign-in identity, personal profile fields, sessions, and push tokens are deleted.</li>
              <li>Organization-owned construction records are retained, transferred, or anonymized according to contract, legal hold, and applicable law.</li>
              <li>Unsynchronized device work must be synchronized, reopened, or intentionally discarded before submission.</li>
              <li>A sole organization administrator must transfer administration or request organization closure first.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/settings/account-deletion" className="inline-flex min-h-11 items-center justify-center rounded-md bg-rc-orange px-5 font-semibold text-white hover:bg-rc-orange-dark">
              Sign in to request deletion
            </Link>
            <a href="mailto:support@railcommand.io?subject=RailCommand%20account%20deletion%20request" className="inline-flex min-h-11 items-center justify-center rounded-md border border-rc-border px-5 font-semibold text-foreground hover:bg-muted">
              I cannot access my account
            </a>
          </div>
          <p>
            If you cannot sign in, email support from the address associated with your account.
            RailCommand will verify identity before processing the request. See the{' '}
            <Link href="/privacy" className="text-rc-orange hover:underline">Privacy Policy</Link>{' '}
            for data categories and retention details.
          </p>
        </section>
      </div>
    </main>
  );
}
