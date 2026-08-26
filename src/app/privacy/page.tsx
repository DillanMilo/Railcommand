import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for RailCommand web and mobile services.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        <header className="space-y-3">
          <Link href="/login" className="text-sm font-semibold text-rc-orange hover:underline">RailCommand</Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: August 26, 2026</p>
          </div>
        </header>

        <section className="space-y-4 leading-7 text-muted-foreground">
          <p>
            RailCommand provides organization-managed project and field-work software for rail and
            construction teams. This policy applies to the RailCommand website, iOS and Android
            applications, and related support services. The initial mobile release is offered in the
            United States only.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Information we collect</h2>
          <p>
            <strong>Account and contact information:</strong> name, email address, optional phone
            number, profile image, organization, role, authentication identifiers, notification
            preferences, and account status. RailCommand never receives the password stored by its
            authentication provider.
          </p>
          <p>
            <strong>Organization and project content:</strong> projects, memberships, daily logs,
            personnel and equipment entries, work summaries, safety notes, RFIs, submittals,
            schedules, photos, files, comments, signatures, and related activity or audit history
            supplied by authorized users.
          </p>
          <p>
            <strong>Device and field information:</strong> a photo or existing library item only
            when a user chooses to attach it; precise or approximate foreground location only when a user taps the
            location action; push-notification token, platform, app version/build, device name or
            class, connectivity/synchronization state, client operation identifiers, retry state,
            and limited technical error information needed to operate and secure the service.
            RailCommand does not use background location, contacts, microphone, advertising ID,
            or cross-app tracking in the scoped mobile release.
          </p>
          <p>
            <strong>Sign-in providers:</strong> if the web service offers and you choose Google
            sign-in, RailCommand receives the basic profile information approved in that flow,
            such as name, email address, and profile image. The mobile field app uses an existing
            organization-issued RailCommand account and does not offer public account creation.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">How information is collected</h2>
          <p>
            Information comes from you, your organization and its administrators, project team
            members, device permissions you choose to grant, authentication and delivery providers,
            and ordinary secure service requests. The mobile app keeps scoped project references,
            drafts, queued operations, and photos in user-partitioned app storage so supported field
            work can continue offline and synchronize later.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">How we use information</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Authenticate users and enforce organization, project, role, and row-level permissions.</li>
            <li>Provide project collaboration, offline draft/queue synchronization, and idempotent delivery.</li>
            <li>Attach user-requested photos and geolocation to field records.</li>
            <li>Send account, invitation, password-recovery, project, and optional push notifications.</li>
            <li>Provide support, prevent abuse, investigate security or reliability problems, and comply with law.</li>
          </ul>
          <p>RailCommand does not sell personal information and does not use app data for third-party advertising or cross-app tracking.</p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Sharing and service providers</h2>
          <p>
            Project content is visible to authorized organization and project members according to
            configured permissions. We use service providers for hosting and application delivery,
            database storage and authentication (Supabase), transactional email (Resend), mobile
            build/update and notification delivery (Expo and the applicable Apple or Google
            platform), and infrastructure protection. If an organization enables an integration
            such as EarthCam, information requested for that integration is exchanged only to
            provide the configured feature. Providers must protect information consistently with
            their contracts and applicable law. We may also disclose information when required by
            law or necessary to protect RailCommand, customers, users, or the public.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Permissions and choices</h2>
          <p>
            Camera, photo-library, foreground location, and notifications are requested at
            the point of use. You can deny or later change those permissions in device settings; the
            app preserves entered text and explains any affected feature. Location can be removed
            from a draft before submission. The operating-system photo picker and share sheet are
            used where practical to minimize access.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Security and device storage</h2>
          <p>
            RailCommand uses HTTPS in transit, platform Keychain or Keystore-backed session storage,
            user-partitioned offline databases, short-lived upload authorization, server-side
            authentication and permission revalidation, and safeguards designed to prevent duplicate
            synchronization. Private project records are not placed in public Cache Storage. No
            security measure can guarantee absolute protection.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Retention, deletion, and organization records</h2>
          <p>
            A verified account-deletion request starts a 30-day recovery period. At its end,
            RailCommand deletes or disables the authentication identity and removes personal profile
            fields, sessions, push tokens, and eligible private account data. Local app data is
            removed during the protected sign-out/deletion flow or at the next authenticated cleanup
            opportunity. Minimal deletion audit events may be retained without credentials, email
            addresses, or field-record contents.
          </p>
          <p>
            Construction and safety records created for a customer organization—including project
            records, daily logs, RFIs, photos, signatures, schedules, and audit history—may remain
            controlled by that organization and be retained, transferred, or anonymized under its
            contract, configured retention schedule, legal hold, and applicable law. Deleted-user
            attribution is replaced with “Former user” where personal identity is not required.
          </p>
          <p>
            Start a request in mobile <strong>Account</strong> settings, from web account settings,
            or through the public{' '}
            <Link href="/account-deletion" className="text-rc-orange hover:underline">account-deletion page</Link>.
            Unsynchronized drafts and queued work must be synchronized, reopened, or intentionally
            discarded first; nothing is silently lost. A sole organization administrator must
            transfer administration or request organization closure before personal deletion can proceed.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Children</h2>
          <p>
            RailCommand is a business field-work service and is not directed to children. It is not
            designated for the Google Play Families program or Apple Kids Category.
          </p>

          <h2 className="pt-4 text-xl font-semibold text-foreground">Updates and contact</h2>
          <p>
            We may update this policy as product behavior or legal requirements change and will
            revise the date above. For privacy questions, access or correction requests, organization
            closure, or deletion assistance, email{' '}
            <a href="mailto:support@railcommand.io" className="text-rc-orange hover:underline">support@railcommand.io</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
