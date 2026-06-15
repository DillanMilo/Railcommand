import type { Metadata } from 'next';
import { LockKeyhole, MapPin, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Access Restricted',
  description: 'RailCommand access is restricted to United States locations.',
};

export default function GeoRestrictedPage() {
  return (
    <main className="min-h-screen bg-rc-bg px-4 py-10 text-foreground dark:bg-rc-bg sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center">
        <section className="w-full">
          <div className="mb-6 flex size-14 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange dark:bg-rc-orange/15">
            <ShieldAlert className="size-7" />
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rc-orange">
            Protected Project Access
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Access is restricted to the United States
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            RailCommand project workflows are only available from verified US IP
            locations. If you are in the United States, turn off any VPN or proxy
            and try again from your normal network.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-rc-border bg-muted/30 p-4">
              <MapPin className="mb-3 size-5 text-rc-emerald" />
              <p className="text-sm font-semibold">US locations only</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Sign-in and project pages check the request location before data
                loads.
              </p>
            </div>
            <div className="rounded-lg border border-rc-border bg-muted/30 p-4">
              <LockKeyhole className="mb-3 size-5 text-rc-blue" />
              <p className="text-sm font-semibold">VPNs may be blocked</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Masked, unknown, or non-US network locations are not permitted.
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            If you believe this is incorrect, contact your RailCommand project
            administrator from an approved US network.
          </p>
        </section>
      </div>
    </main>
  );
}
