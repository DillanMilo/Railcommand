'use client';

import React, { useState, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPDFButtonProps {
  document: React.ReactElement;
  fileName: string;
  variant?: 'default' | 'icon';
}

export default function ExportPDFButton({
  document: pdfDocument,
  fileName,
  variant = 'default',
}: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(pdfDocument as any).toBlob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setLoading(false);
    }
  }, [pdfDocument, fileName]);

  if (variant === 'icon') {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={handleExport}
        disabled={loading}
        aria-label="Export PDF"
      >
        <FileDown className={loading ? 'animate-pulse' : ''} />
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <FileDown />
      {loading ? 'Generating...' : 'Export PDF'}
    </Button>
  );
}
