import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Confirm password reset',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ConfirmRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token_hash === 'string' && params.token_hash.length <= 1024
    ? params.token_hash : '';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f2] px-4 py-10 text-slate-950">
      <div className="w-full max-w-lg">
        <Image src="/IMG_0938.jpg" alt="RailCommand" width={210} height={50} priority className="mx-auto mb-8 h-auto w-[190px]" />
        <section className="border border-slate-200 bg-white shadow-[8px_8px_0_rgba(15,23,42,0.08)]">
          <h1 className="bg-slate-950 px-6 py-5 font-heading text-2xl font-bold text-white sm:px-8">Reset your password</h1>
          <div className="space-y-5 px-6 py-7 sm:px-8">
            <p className="text-sm leading-6 text-slate-600">
              Continue to choose a new password for your RailCommand account.
              You can finish here, then sign in to the app or website with your new password.
            </p>
            {params.error === 'temporarily_unavailable' && (
              <p role="alert" className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                We couldn’t connect to verify your link. Check your connection and try again.
              </p>
            )}
            {token ? (
              <form action="/auth/recovery/confirm" method="post">
                <input type="hidden" name="token_hash" value={token} />
                <button type="submit" className="min-h-12 w-full bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                  Continue to reset password
                </button>
              </form>
            ) : (
              <p role="alert" className="text-sm text-red-700">This link is incomplete. Request a new password reset link.</p>
            )}
            <p className="text-xs leading-5 text-slate-500">An internet connection is required. Reset links expire after one hour and can only be used once.</p>
            <Link href="/login?error=recovery_link_invalid" prefetch={false} className="inline-block text-sm font-semibold text-slate-700 underline">Request a new link</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
