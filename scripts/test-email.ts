// scripts/test-email.ts
//
// Quick smoke test for Resend email delivery.
// Usage: npx tsx scripts/test-email.ts user@example.com

import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Load env from .env.local (Next.js convention) or .env
// ---------------------------------------------------------------------------
async function loadEnv() {
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: '.env.local' });
    dotenv.config(); // fallback to .env
  } catch {
    // dotenv not installed — rely on process.env
  }
}

async function main() {
  await loadEnv();

  const recipient = process.argv[2];
  if (!recipient) {
    console.error('Usage: npx tsx scripts/test-email.ts <recipient@example.com>');
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Error: RESEND_API_KEY is not set. Add it to .env.local or export it.');
    process.exit(1);
  }

  const timestamp = new Date().toISOString();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RailCommand Email Test</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e293b;padding:20px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.025em;">
                RailCommand
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:600;">
                Email Delivery Test
              </h2>
              <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6;">
                If you're reading this, email delivery from
                <strong>railcommand.a5rail.com</strong> is working correctly!
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                Sent at: ${timestamp}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                This is an automated test email from RailCommand.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const resend = new Resend(apiKey);

  console.log(`Sending test email to ${recipient}...`);

  const { data, error } = await resend.emails.send({
    from: 'RailCommand <noreply@railcommand.a5rail.com>',
    to: recipient,
    subject: 'RailCommand Email Test',
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }

  console.log(`Success! Message ID: ${data?.id}`);
  process.exit(0);
}

main();
