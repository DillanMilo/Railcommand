import { NextRequest, NextResponse } from 'next/server';
import { finalizeDueAccountDeletions } from '@/lib/account-deletion-finalizer';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await finalizeDueAccountDeletions();
    return NextResponse.json({
      success: true,
      processed: results.length,
      completed: results.filter((result) => result.status === 'completed').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
    });
  } catch (error) {
    console.error('[cron/account-deletion-finalize] Failed:', error);
    return NextResponse.json({ error: 'Account-deletion finalization failed' }, { status: 500 });
  }
}
