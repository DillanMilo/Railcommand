import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.io>';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const IP_RATE_LIMIT = 10;
const EMAIL_RATE_LIMIT = 3;

const projectSizeValues = [
  '0-1m',
  '1m-10m',
  '10m-50m',
  '50m-100m',
  '100m-plus',
] as const;
const buyerTypeValues = ['individual', 'small-group', 'project-team', 'enterprise'] as const;
const billingPreferenceValues = ['monthly', 'yearly', 'enterprise-call'] as const;

const PROJECT_SIZE_LABELS: Record<
  (typeof projectSizeValues)[number],
  { label: string; annualPercent: string; maxAnnualCost: string }
> = {
  '0-1m': {
    label: '$0-$1M',
    annualPercent: '1%',
    maxAnnualCost: '$10,000',
  },
  '1m-10m': {
    label: '$1M-$10M',
    annualPercent: '0.75%',
    maxAnnualCost: '$75,000',
  },
  '10m-50m': {
    label: '$10M-$50M',
    annualPercent: '0.5%',
    maxAnnualCost: '$250,000',
  },
  '50m-100m': {
    label: '$50M-$100M',
    annualPercent: '0.25%',
    maxAnnualCost: '$250,000',
  },
  '100m-plus': {
    label: '$100M+',
    annualPercent: '0.15%',
    maxAnnualCost: 'Varies',
  },
};

const BUYER_TYPE_LABELS: Record<(typeof buyerTypeValues)[number], string> = {
  individual: 'Individual user',
  'small-group': 'Small group',
  'project-team': 'Project team',
  enterprise: 'Enterprise / owner account',
};

const BILLING_PREFERENCE_LABELS: Record<(typeof billingPreferenceValues)[number], string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  'enterprise-call': 'Call for enterprise',
};

const accessRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  companyName: z.string().trim().min(2).max(160),
  buyerType: z.enum(buyerTypeValues).default('project-team'),
  billingPreference: z.enum(billingPreferenceValues).default('enterprise-call'),
  projectSize: z.enum(projectSizeValues),
  note: z.string().trim().max(1000).optional(),
});

type AccessRequest = z.infer<typeof accessRequestSchema>;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function getRecipients(): string[] {
  const configured =
    process.env.ACCESS_REQUEST_RECIPIENTS ??
    process.env.SALES_NOTIFICATION_EMAIL ??
    '';

  return configured
    .split(',')
    .map((email) => email.trim())
    .filter((email) => EMAIL_REGEX.test(email));
}

function buildEmailText(input: AccessRequest, requestIp: string): string {
  const pricing = PROJECT_SIZE_LABELS[input.projectSize];
  const buyerType = BUYER_TYPE_LABELS[input.buyerType];
  const billingPreference = BILLING_PREFERENCE_LABELS[input.billingPreference];
  const note = input.note?.trim() || 'None provided';

  return [
    'New RailCommand pricing request',
    '',
    `Name: ${input.fullName}`,
    `Email: ${input.email}`,
    `Company: ${input.companyName}`,
    `Best fit: ${buyerType}`,
    `Billing preference: ${billingPreference}`,
    `Project size: ${pricing.label}`,
    `Pricing band: ${pricing.annualPercent} annually, max ${pricing.maxAnnualCost}`,
    '',
    'Notes:',
    note,
    '',
    `Request IP: ${requestIp}`,
    `Submitted: ${new Date().toISOString()}`,
  ].join('\n');
}

function buildEmailHtml(input: AccessRequest, requestIp: string): string {
  const pricing = PROJECT_SIZE_LABELS[input.projectSize];
  const buyerType = BUYER_TYPE_LABELS[input.buyerType];
  const billingPreference = BILLING_PREFERENCE_LABELS[input.billingPreference];
  const note = input.note?.trim() || 'None provided';
  const submittedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
  });

  const rows = [
    ['Name', input.fullName],
    ['Email', input.email],
    ['Company', input.companyName],
    ['Best fit', buyerType],
    ['Billing preference', billingPreference],
    ['Project size', pricing.label],
    ['Pricing band', `${pricing.annualPercent} annually, max ${pricing.maxAnnualCost}`],
    ['Submitted', `${submittedAt} CT`],
    ['Request IP', requestIp],
  ];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New RailCommand Pricing Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
          <tr>
            <td style="background-color:#0f172a;padding:28px 32px 22px;border-bottom:8px solid #f97316;">
              <p style="margin:0;color:#ffffff;font-size:22px;line-height:1.2;font-weight:800;">RailCommand</p>
              <p style="margin:6px 0 0;color:#fed7aa;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;">New pricing request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:1.2;font-weight:800;">${escapeHtml(input.companyName)} requested RailCommand pricing</h1>
              <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.65;">
                A prospect submitted the public pricing qualifier.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                ${rows
                  .map(
                    ([label, value]) => `
                <tr>
                  <td style="width:34%;padding:13px 16px;background-color:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</td>
                  <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:15px;line-height:1.45;font-weight:700;">${escapeHtml(value)}</td>
                </tr>`.trim(),
                  )
                  .join('')}
              </table>

              <div style="margin-top:22px;padding:18px 20px;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <p style="margin:0 0 8px;color:#ea580c;font-size:12px;line-height:1.4;font-weight:800;text-transform:uppercase;">Notes</p>
                <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.65;white-space:pre-wrap;">${escapeHtml(note)}</p>
              </div>

              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                Reply directly to this email to contact ${escapeHtml(input.fullName)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const requestIp = getRequestIp(request);

    if (!checkRateLimit(`ip:${requestIp}`, IP_RATE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 },
      );
    }

    const parsed = accessRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please complete all required fields.' },
        { status: 400 },
      );
    }

    const accessRequest = parsed.data;
    if (!checkRateLimit(`email:${accessRequest.email}`, EMAIL_RATE_LIMIT)) {
      return NextResponse.json(
        { error: 'Too many requests for this email. Try again later.' },
        { status: 429 },
      );
    }

    const recipients = getRecipients();
    if (recipients.length === 0) {
      console.error('[api/access-request] ACCESS_REQUEST_RECIPIENTS is not configured');
      return NextResponse.json(
        { error: 'Access requests are not configured yet.' },
        { status: 500 },
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[api/access-request] RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email delivery is not configured yet.' },
        { status: 500 },
      );
    }

    const buyerType = BUYER_TYPE_LABELS[accessRequest.buyerType];
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      replyTo: accessRequest.email,
      subject: `RailCommand pricing request: ${accessRequest.companyName} (${buyerType})`,
      html: buildEmailHtml(accessRequest, requestIp),
      text: buildEmailText(accessRequest, requestIp),
      tags: [{ name: 'type', value: 'access_request' }],
    });

    if (error) {
      console.error('[api/access-request] Resend error:', error);
      return NextResponse.json(
        { error: 'Could not send the access request.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('[api/access-request] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
