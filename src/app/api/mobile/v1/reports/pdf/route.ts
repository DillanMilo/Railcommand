import { authenticateMobileRequest, mobileOptions } from '@/lib/mobile-api/auth';
import { createPdfReportHandler } from '@/lib/mobile-api/report-export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const OPTIONS = mobileOptions;
export const POST = createPdfReportHandler({
  authenticate: authenticateMobileRequest,
  render: async (data) => {
    const { renderMobilePdfReport } = await import('@/lib/mobile-api/render-report');
    return renderMobilePdfReport(data);
  },
});
