// src/app/api/email/send/route.ts
//
// Generic email send endpoint with basic rate limiting.
// Accepts: { to, subject, html, type }

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { recordEmailEvent } from '@/lib/email-events';

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.io>';

// Simple in-memory rate limiter (resets on cold start — fine for serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // max emails per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DMARC_PATTERN = /\bdmarc\b/i;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isDmarcEmail(input: { subject: string; html: string; type?: string }): boolean {
  return [input.type, input.subject, input.html].some(
    (value) => typeof value === 'string' && DMARC_PATTERN.test(value)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Auth: require bearer token matching RESEND_API_KEY or a dedicated EMAIL_API_KEY
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.EMAIL_API_KEY ?? process.env.NOTIFICATIONS_API_KEY;
    if (!expectedKey) {
      return NextResponse.json({ error: 'Email endpoint not configured' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, html, type } = body as {
      to: string;
      subject: string;
      html: string;
      type?: string;
    };

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }

    if (isDmarcEmail({ subject, html, type })) {
      await recordEmailEvent({
        type: type ?? 'api_email',
        recipientEmail: to,
        subject,
        status: 'suppressed',
        errorMessage: 'DMARC-related emails are not sent to users',
      });
      return NextResponse.json({ success: true, suppressed: true });
    }

    // Rate limit by recipient
    if (!checkRateLimit(to)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      await recordEmailEvent({
        type: type ?? 'api_email',
        recipientEmail: to,
        subject,
        status: 'skipped',
        errorMessage: 'RESEND_API_KEY not configured',
      });
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      tags: type ? [{ name: 'type', value: type }] : undefined,
    });

    if (error) {
      console.error('[api/email/send] Resend error:', error);
      await recordEmailEvent({
        type: type ?? 'api_email',
        recipientEmail: to,
        subject,
        status: 'failed',
        errorMessage: error.message,
      });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    await recordEmailEvent({
      type: type ?? 'api_email',
      recipientEmail: to,
      subject,
      providerMessageId: data?.id,
      status: 'sent',
    });

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('[api/email/send] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
