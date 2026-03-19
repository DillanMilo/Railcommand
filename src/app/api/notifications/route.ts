// src/app/api/notifications/route.ts
//
// API route for sending notifications. Can be called from server actions
// or external webhooks. Validates the request and delegates to the
// notification service.

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';
import type { NotificationPayload } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.NOTIFICATIONS_API_KEY;

    // If an API key is configured, enforce it. Otherwise allow
    // server-to-server calls (e.g. from same-origin server actions).
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { recipientUserId, payload } = body as {
      recipientUserId: string;
      payload: NotificationPayload;
    };

    if (!recipientUserId || !payload || !payload.type) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientUserId, payload.type' },
        { status: 400 }
      );
    }

    // Fire and forget -- we don't want to block the response
    // but we do await here so the serverless function stays alive
    await sendNotification(recipientUserId, payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/notifications] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
