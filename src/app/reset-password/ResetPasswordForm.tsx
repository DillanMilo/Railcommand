'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { getSupabaseAuthErrorMessage } from '@/lib/supabase/connectivity';

export default function ResetPasswordForm({ email }: { email: string }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinimumLength = newPassword.length >= 8;
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!hasMinimumLength) {
      setError('Your new password must be at least 8 characters.');
      return;
    }

    if (!passwordsMatch) {
      setError('The passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(getSupabaseAuthErrorMessage(updateError));
        return;
      }

      await supabase.auth.signOut({ scope: 'local' });
      await fetch('/api/auth/password-reset', { method: 'DELETE' }).catch(() => {});

      try {
        localStorage.removeItem('rc-mode');
        localStorage.removeItem('rc-current-project');
        document.cookie = 'rc-remember=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'rc-onboarded=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'rc-mode=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'rc-demo-slug=; path=/; max-age=0; SameSite=Lax';
      } catch {
        // Browser privacy settings may block client storage cleanup.
      }

      window.location.replace('/login?password_reset=success');
    } catch (updateError) {
      setError(getSupabaseAuthErrorMessage(updateError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f6f2] px-4 py-10 text-slate-950 sm:px-6 sm:py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-orange-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex justify-center">
            <Image
              src="/IMG_0938.jpg"
              alt="RailCommand"
              width={210}
              height={50}
              priority
              className="h-auto w-[190px] object-contain"
            />
          </div>

          <section className="border border-slate-200 bg-white shadow-[8px_8px_0_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center bg-orange-500">
                  <ShieldCheck className="size-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-400">
                    Account security
                  </p>
                  <h1 className="font-heading text-xl font-bold sm:text-2xl">
                    Create a new password
                  </h1>
                </div>
              </div>
            </div>

            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <p className="text-sm leading-6 text-slate-600">
                Choose a new password for{' '}
                <span className="font-semibold text-slate-900">{email}</span>.
                After it is updated, you’ll return to sign in.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="new-password"
                    className="text-sm font-semibold text-slate-900"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Enter your new password"
                      className="h-12 rounded-none border-slate-300 bg-white pl-10 pr-11 text-slate-950"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-semibold text-slate-900"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <LockKeyhole
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Confirm your new password"
                      className="h-12 rounded-none border-slate-300 bg-white pl-10 pr-11 text-slate-950"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirmed password'
                          : 'Show confirmed password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full ${
                        hasMinimumLength
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    At least 8 characters
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-4 items-center justify-center rounded-full ${
                        passwordsMatch
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    Passwords match
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-none bg-orange-500 font-semibold text-white hover:bg-orange-600"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Updating password…
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </form>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:px-8">
              <span>Secure one-time recovery</span>
              <Link
                href="/login"
                className="font-semibold text-slate-700 transition-colors hover:text-orange-600"
              >
                Back to sign in
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
