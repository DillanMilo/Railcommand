import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for RailCommand.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        <header className="space-y-3">
          <Link href="/login" className="text-sm font-semibold text-rc-orange hover:underline">
            RailCommand
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">Last updated: June 24, 2026</p>
          </div>
        </header>

        <section className="space-y-4 leading-7 text-muted-foreground">
          <p>
            These Terms of Service govern your access to and use of RailCommand, a project
            management platform for construction and rail teams. By using RailCommand, you agree to
            these terms.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Use Of The Service</h2>
          <p>
            You are responsible for maintaining accurate account information, protecting your login
            credentials, and using RailCommand only for lawful business purposes. You may not use the
            service to interfere with other users, attempt unauthorized access, or upload content that
            violates law or third-party rights.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Project Content</h2>
          <p>
            Your organization retains ownership of the project data, documents, photos, comments,
            and other content submitted to RailCommand. You grant RailCommand permission to process
            that content as needed to provide, secure, support, and improve the service.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Availability And Changes</h2>
          <p>
            We work to keep RailCommand reliable, but we do not guarantee uninterrupted access. We
            may update, suspend, or modify features to maintain security, performance, compliance, or
            product quality.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Third-Party Services</h2>
          <p>
            RailCommand may integrate with third-party services such as authentication, email,
            storage, hosting, or mapping providers. Your use of those services may also be subject to
            their terms and policies.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Contact</h2>
          <p>
            For questions about these terms, contact us at{' '}
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
