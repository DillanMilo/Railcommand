'use client';

import { shareWorkspaceBlob } from '@/lib/native-workspace';
import React, { useState, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPDFButtonProps {
  /** Lazy document loader. Called on click so the PDF module isn't in the page bundle. */
  getDocument: () => Promise<React.ReactElement>;
  fileName: string;
  variant?: 'default' | 'icon';
}

export default function ExportPDFButton({
  getDocument,
  fileName,
  variant = 'default',
}: ExportPDFButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const [{ pdf }, pdfDocument] = await Promise.all([
        import('@react-pdf/renderer'),
        getDocument(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(pdfDocument as any).toBlob();
      if (await shareWorkspaceBlob(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)) return;
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not generate the PDF. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [getDocument, fileName]);

  if (variant === 'icon') {
    return (
      <span>
      <Button
        variant="outline"
        size="icon"
        onClick={handleExport}
        disabled={loading}
        aria-label="Export PDF"
      >
        <FileDown className={loading ? 'animate-pulse' : ''} />
      </Button>
      {errorMessage && <span role="alert" className="block text-sm text-red-600">{errorMessage}</span>}
      </span>
    );
  }

  return (
    <span>
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <FileDown />
      {loading ? 'Generating...' : 'Export PDF'}
    </Button>
    {errorMessage && <span role="alert" className="block text-sm text-red-600">{errorMessage}</span>}
    </span>
  );
}
