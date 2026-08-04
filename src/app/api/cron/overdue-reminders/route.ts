// src/app/api/cron/overdue-reminders/route.ts
//
// Automated reminder emails are intentionally disabled. This retired endpoint
// remains explicit so an old external scheduler cannot trigger email delivery.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Automated email reminders are disabled' },
    { status: 410 },
  );
}
