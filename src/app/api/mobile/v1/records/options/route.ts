import { authenticateMobileRequest, mobileOptions } from '@/lib/mobile-api/auth';
import { createRecordOptionsHandler } from '@/lib/mobile-api/record-create';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const OPTIONS = mobileOptions;
export const GET = createRecordOptionsHandler(authenticateMobileRequest);
