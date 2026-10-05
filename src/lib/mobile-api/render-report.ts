import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import RFIsPDF from '../pdf/RFIsPDF';
import SubmittalsPDF from '../pdf/SubmittalsPDF';
import type { PdfReportData } from './report-export';

// Use the web app's actual PDF templates, not a reduced mobile approximation.
export function renderMobilePdfReport(data: PdfReportData): Promise<Buffer> {
  const document = data.kind === 'rfis'
    ? createElement(RFIsPDF, { rfis: data.records, projectName: data.projectName, generatedBy: data.generatedBy })
    : createElement(SubmittalsPDF, { submittals: data.records, projectName: data.projectName, generatedBy: data.generatedBy });
  // Both report components resolve to a react-pdf Document. The renderer's
  // signature describes that root, rather than custom component prop types.
  return renderToBuffer(document as ReactElement<DocumentProps>);
}
