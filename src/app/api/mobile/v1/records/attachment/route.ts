import { authenticateMobileRequest, mobileOptions } from '@/lib/mobile-api/auth';
import { createRecordAttachmentHandler } from '@/lib/mobile-api/record-detail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const OPTIONS = mobileOptions;
export const GET = createRecordAttachmentHandler(authenticateMobileRequest, () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
