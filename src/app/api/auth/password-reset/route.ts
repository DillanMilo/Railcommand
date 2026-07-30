import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { recordEmailEvent } from '@/lib/email-events';
import { createAdminClient } from '@/lib/supabase/admin';

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.io>';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function isWithinRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://railcommand.io'
  ).replace(/\/+$/, '');
}

function buildRecoveryEmail(resetUrl: string): string {
  const escapedUrl = resetUrl.replaceAll('&', '&amp;');

  return `
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
      <div style="text-align:center;padding:32px 0 24px">
        <div style="display:inline-block;width:48px;height:48px;background-color:#F97316;border-radius:12px;line-height:48px;text-align:center">
          <span style="color:white;font-size:24px;font-weight:bold">R</span>
        </div>
        <h1 style="margin:16px 0 4px;font-size:22px;font-weight:700">RailCommand</h1>
        <p style="margin:0;color:#6b7280;font-size:14px">Construction &amp; Rail Project Management</p>
      </div>
      <div style="padding:0 24px 32px">
        <h2 style="font-size:18px;margin-bottom:12px">Reset your password</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6">
          We received a request to reset the password for your RailCommand account.
          Click the button below to choose a new password.
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${escapedUrl}" style="display:inline-block;background-color:#F97316;color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px">
            Reset Password
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">
          This link expires in 24 hours and can only be used once. If you didn't request
          a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

function genericSuccessResponse() {
  return NextResponse.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  });
}

export async function POST(request: NextRequest) {
  let email = '';

  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const emailKey = createHash('sha256').update(email).digest('hex');
  const allowedForEmail = isWithinRateLimit(
    `email:${emailKey}`,
    MAX_REQUESTS_PER_EMAIL
  );
  const allowedForIp = isWithinRateLimit(
    `ip:${getClientIp(request)}`,
    MAX_REQUESTS_PER_IP
  );

  if (!allowedForEmail || !allowedForIp) {
    return genericSuccessResponse();
  }

  try {
    const admin = createAdminClient();
    const appUrl = getAppUrl();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${appUrl}/settings?recovery=1`,
      },
    });

    if (error || !data.properties?.hashed_token) {
      if (error && !/user.*not found/i.test(error.message)) {
        console.error('[api/auth/password-reset] Failed to generate link:', error.message);
      }
      return genericSuccessResponse();
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[api/auth/password-reset] RESEND_API_KEY is not configured');
      return genericSuccessResponse();
    }

    const resetUrl = new URL('/auth/callback', appUrl);
    resetUrl.searchParams.set('token_hash', data.properties.hashed_token);
    resetUrl.searchParams.set('type', 'recovery');
    resetUrl.searchParams.set('next', '/settings?recovery=1');

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Reset your RailCommand password',
      html: buildRecoveryEmail(resetUrl.toString()),
      tags: [{ name: 'type', value: 'password_recovery' }],
    });

    if (sendError) {
      console.error('[api/auth/password-reset] Resend error:', sendError.message);
      await recordEmailEvent({
        type: 'password_recovery',
        recipientEmail: email,
        subject: 'Reset your RailCommand password',
        status: 'failed',
        errorMessage: sendError.message,
      });
      return genericSuccessResponse();
    }

    await recordEmailEvent({
      type: 'password_recovery',
      recipientEmail: email,
      subject: 'Reset your RailCommand password',
      providerMessageId: sent?.id,
      status: 'sent',
    });
  } catch (error) {
    console.error(
      '[api/auth/password-reset] Unexpected error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  return genericSuccessResponse();
}
