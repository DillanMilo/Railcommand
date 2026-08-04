'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Download, FolderOpen, Loader2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import QueryError from '@/components/shared/QueryError';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectDocuments } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import { getDocumentAttachmentsForDownload } from '@/lib/actions/attachments';
import {
  createDocumentArchive,
  saveDocumentArchive,
  type DocumentDownloadFile,
} from '@/lib/document-download';
import { DOCUMENT_STATUS_COLORS, DOCUMENT_STATUS_LABELS, DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DocumentCategory, DocumentStatus } from '@/lib/types';

const CATEGORY_TABS: { label: string; value: DocumentCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drawings', value: 'drawing' },
  { label: 'Specifications', value: 'specification' },
  { label: 'Submittals', value: 'submittal' },
  { label: 'Reports', value: 'report' },
  { label: 'Contracts', value: 'contract' },
  { label: 'Correspondence', value: 'correspondence' },
  { label: 'Other', value: 'other' },
];

const STATUS_PILLS: { label: string; value: DocumentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Issued', value: 'issued' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Superseded', value: 'superseded' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { isDemo } = useProject();
  const urlSearchParams = useSearchParams();
  const { can } = usePermissions(projectId);

  const VALID_STATUSES: ReadonlyArray<DocumentStatus> = ['draft', 'issued', 'under_review', 'approved', 'superseded'];
  const statusParam = urlSearchParams?.get('status');
  const initialStatus: DocumentStatus | 'all' =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as DocumentStatus)
      : 'all';

  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>(initialStatus);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const { data: documents, loading, error, refetch } = useProjectDocuments(projectId);

  const counts = useMemo(() => ({
    draft: documents.filter((d) => d.status === 'draft').length,
    issued: documents.filter((d) => d.status === 'issued').length,
    under_review: documents.filter((d) => d.status === 'under_review').length,
    approved: documents.filter((d) => d.status === 'approved').length,
    superseded: documents.filter((d) => d.status === 'superseded').length,
  }), [documents]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !d.title?.toLowerCase().includes(q) &&
          !(d.description ?? '').toLowerCase().includes(q) &&
          !(d.file_name ?? '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [documents, categoryFilter, statusFilter, search]);

  const basePath = `/projects/${projectId}/documents`;
  const allFilteredSelected = filtered.length > 0 && filtered.every((doc) => selectedIds.has(doc.id));
  const someFilteredSelected = filtered.some((doc) => selectedIds.has(doc.id));

  function toggleDocument(documentId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
    setDownloadError(null);
    setDownloadNotice(null);
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filtered.forEach((doc) => next.delete(doc.id));
      else filtered.forEach((doc) => next.add(doc.id));
      return next;
    });
    setDownloadError(null);
    setDownloadNotice(null);
  }

  async function handleDownloadSelected() {
    if (selectedIds.size === 0 || downloading) return;

    setDownloading(true);
    setDownloadError(null);
    setDownloadNotice(null);

    try {
      const selectedDocuments = documents.filter((doc) => selectedIds.has(doc.id));
      let files: DocumentDownloadFile[];

      if (isDemo) {
        const store = await import('@/lib/store');
        files = selectedDocuments.flatMap((doc) =>
          store.getAttachments('project_document', doc.id).map((attachment) => ({
            id: attachment.id,
            document_id: doc.id,
            document_number: doc.number,
            document_title: doc.title,
            file_name: attachment.file_name,
            file_size: attachment.file_size,
            download_url: attachment.signed_url ?? attachment.file_url,
          })),
        );
      } else {
        const result = await getDocumentAttachmentsForDownload(projectId, selectedDocuments.map((doc) => doc.id));
        if (result.error || !result.data) {
          throw new Error(result.error ?? 'Could not prepare the selected documents.');
        }
        files = result.data;
      }

      const archive = await createDocumentArchive(files);
      const archiveName = `RailCommand-Documents-${new Date().toISOString().slice(0, 10)}.zip`;
      saveDocumentArchive(archive, archiveName);

      const documentIdsWithFiles = new Set(files.map((file) => file.document_id));
      const missingCount = selectedDocuments.filter((doc) => !documentIdsWithFiles.has(doc.id)).length;
      if (missingCount > 0) {
        setDownloadNotice(
          `${files.length} file${files.length === 1 ? '' : 's'} downloaded. ${missingCount} selected document${missingCount === 1 ? '' : 's'} had no uploaded files.`,
        );
      }
      setSelectedIds(new Set());
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'The download could not be completed.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documents' }]} />
        <QueryError message="Couldn't load documents" onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documents' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Documents</h1>
            <Badge variant="secondary" className="text-xs">{documents.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {counts.draft} draft, {counts.issued} issued, {counts.under_review} under review, {counts.approved} approved
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadSelected}
            disabled={selectedIds.size === 0 || downloading}
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {downloading ? 'Preparing ZIP...' : `Download selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </Button>
          {can(ACTIONS.DOCUMENT_MANAGE) && (
            <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />Upload Document</Link>
            </Button>
          )}
        </div>
      </div>

      {downloadError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {downloadError}
        </div>
      )}
      {downloadNotice && (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {downloadNotice}
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search by title, description, or file name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setCategoryFilter(t.value)}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px] ${
              categoryFilter === t.value ? 'border-rc-orange text-rc-orange' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_PILLS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              statusFilter === s.value
                ? 'bg-rc-orange text-white border-rc-orange'
                : 'bg-transparent text-muted-foreground border-rc-border hover:text-foreground hover:border-foreground/30'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {selectedIds.size === 0 ? 'Select documents to download together' : `${selectedIds.size} selected`}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={toggleAllFiltered}>
            {allFilteredSelected ? 'Deselect visible' : 'Select all visible'}
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block rounded-lg border border-rc-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-rc-card">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible documents"
                  checked={allFilteredSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someFilteredSelected && !allFilteredSelected;
                  }}
                  onChange={toggleAllFiltered}
                  disabled={filtered.length === 0}
                  className="size-4 accent-rc-orange"
                />
              </TableHead>
              <TableHead className="w-[90px]">Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">File Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id} data-state={selectedIds.has(doc.id) ? 'selected' : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${doc.number}: ${doc.title}`}
                    checked={selectedIds.has(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="size-4 accent-rc-orange"
                  />
                </TableCell>
                <TableCell>
                  <Link href={`${basePath}/${doc.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">{doc.number}</Link>
                </TableCell>
                <TableCell className="max-w-[260px] truncate">
                  <Link href={`${basePath}/${doc.id}`} className="hover:underline py-1 inline-block">{doc.title}</Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-medium">
                    {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{doc.revision}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn('border-0 font-medium text-xs', DOCUMENT_STATUS_COLORS[doc.status])}>
                    {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                  </Badge>
                </TableCell>
                <TableCell>{doc.uploaded_by_profile?.full_name ?? '\u2014'}</TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(doc.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatFileSize(doc.file_size)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  {documents.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <FolderOpen className="size-10 text-muted-foreground/40" />
                      <p>No documents uploaded yet</p>
                    </div>
                  ) : (
                    'No items match your filters.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 && documents.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FolderOpen className="size-10 text-muted-foreground/40" />
            <p>No documents uploaded yet</p>
          </div>
        )}
        {filtered.length === 0 && documents.length > 0 && (
          <p className="text-center py-10 text-muted-foreground">No items match your filters.</p>
        )}
        {filtered.map((doc) => (
          <Card key={doc.id} className={cn('transition-shadow hover:shadow-md', selectedIds.has(doc.id) && 'bg-muted')}>
            <CardContent className="flex items-start gap-3 p-4">
              <input
                type="checkbox"
                aria-label={`Select ${doc.number}: ${doc.title}`}
                checked={selectedIds.has(doc.id)}
                onChange={() => toggleDocument(doc.id)}
                className="mt-1 size-4 shrink-0 accent-rc-orange"
              />
              <Link href={`${basePath}/${doc.id}`} className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-rc-blue">{doc.number}</span>
                  <Badge variant="secondary" className={cn('border-0 text-xs', DOCUMENT_STATUS_COLORS[doc.status])}>
                    {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
                  </Badge>
                </div>
                <p className="font-medium text-sm line-clamp-2">{doc.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{doc.revision}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{doc.uploaded_by_profile?.full_name ?? '\u2014'}</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
