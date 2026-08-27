'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FileDown, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPDFButtonProps {
  /** Lazy document loader. Called on click so the PDF module isn't in the page bundle. */
  getDocument: () => Promise<React.ReactElement>;
  fileName: string;
  variant?: 'default' | 'icon';
  allowShare?: boolean;
  shareTitle?: string;
}

export default function ExportPDFButton({
  getDocument,
  fileName,
  variant = 'default',
  allowShare = false,
  shareTitle = 'RailCommand PDF',
}: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);
  const [preparedShareFile, setPreparedShareFile] = useState<File | null>(null);

  useEffect(() => {
    setShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const generatePdf = useCallback(async (): Promise<{ blob: Blob; completeFileName: string }> => {
    const [{ pdf }, pdfDocument] = await Promise.all([
      import('@react-pdf/renderer'),
      getDocument(),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(pdfDocument as any).toBlob();
    return {
      blob,
      completeFileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    };
  }, [fileName, getDocument]);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const { blob, completeFileName } = await generatePdf();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = completeFileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setLoading(false);
    }
  }, [generatePdf]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      let file = preparedShareFile;
      if (!file) {
        const { blob, completeFileName } = await generatePdf();
        file = new File([blob], completeFileName, { type: 'application/pdf' });
        // Some mobile browsers require a second, synchronous user gesture after
        // asynchronous PDF generation. Keep the prepared file for that retry.
        setPreparedShareFile(file);
      }
      if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
        throw new Error('PDF file sharing is not supported on this device');
      }
      await navigator.share({ title: shareTitle, files: [file] });
      setPreparedShareFile(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to share PDF:', error);
    } finally {
      setSharing(false);
    }
  }, [generatePdf, preparedShareFile, shareTitle]);

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
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handleExport} disabled={loading || sharing}>
        <FileDown />
        {loading ? 'Generating...' : 'Export PDF'}
      </Button>
      {allowShare && shareSupported && (
        <Button variant="outline" onClick={handleShare} disabled={loading || sharing}>
          <Share2 />
          {sharing ? 'Preparing...' : preparedShareFile ? 'Tap to Share PDF' : 'Share PDF'}
        </Button>
      )}
    </div>
  );
}
