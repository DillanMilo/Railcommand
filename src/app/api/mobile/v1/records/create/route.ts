import { authenticateMobileRequest, mobileOptions } from '@/lib/mobile-api/auth';
import { createRecordCreateHandler } from '@/lib/mobile-api/record-create';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const OPTIONS = mobileOptions;
export const POST = createRecordCreateHandler(authenticateMobileRequest);
