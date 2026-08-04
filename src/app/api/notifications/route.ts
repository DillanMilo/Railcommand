// src/app/api/notifications/route.ts
//
// Automated notification email delivery is intentionally disabled.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Automated notification emails are disabled' },
    { status: 410 },
  );
}
