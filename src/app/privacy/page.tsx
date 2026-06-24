import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for RailCommand.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        <header className="space-y-3">
          <Link href="/login" className="text-sm font-semibold text-rc-orange hover:underline">
            RailCommand
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 24, 2026</p>
          </div>
        </header>

        <section className="space-y-4 leading-7 text-muted-foreground">
          <p>
            RailCommand provides project management software for construction and rail teams. This
            policy explains what information we collect, how we use it, and how to contact us.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Information We Collect</h2>
          <p>
            We collect account information such as name, email address, organization, authentication
            details, and preferences. When you use RailCommand, we also store project information you
            choose to enter, including RFIs, submittals, daily logs, photos, comments, files,
            schedules, team records, and related activity.
          </p>
          <p>
            If you sign in with Google, we receive basic profile information from Google, such as
            your name, email address, and profile image, so we can create and secure your
            RailCommand account.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">How We Use Information</h2>
          <p>
            We use information to provide the RailCommand service, authenticate users, manage
            projects, send important account and project notifications, provide support, protect the
            service, and improve reliability and product performance.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Sharing</h2>
          <p>
            We do not sell personal information. We share information only as needed to operate the
            service, comply with law, protect RailCommand and our users, or with project team members
            and organizations based on permissions configured in the product.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Security And Retention</h2>
          <p>
            We use administrative, technical, and organizational safeguards designed to protect user
            and project information. We retain information for as long as needed to provide the
            service, comply with legal obligations, resolve disputes, and enforce agreements.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
          <p>
            For privacy questions or requests, contact us at{' '}
            <a href="mailto:support@railcommand.io" className="text-rc-orange hover:underline">
              support@railcommand.io
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
