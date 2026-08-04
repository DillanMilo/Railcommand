// src/app/api/email/send/route.ts
//
// Generic machine-to-machine email delivery is intentionally disabled. Email
// may only be sent by explicit user-facing application flows.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Machine-triggered email delivery is disabled' },
    { status: 410 },
  );
}
