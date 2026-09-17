import { authenticateMobileRequest, mobileOptions } from '@/lib/mobile-api/auth';
import { createRecordDetailHandler } from '@/lib/mobile-api/record-detail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const OPTIONS = mobileOptions;
export const GET = createRecordDetailHandler(authenticateMobileRequest);
