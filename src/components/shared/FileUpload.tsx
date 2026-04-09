'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadAttachment, deleteAttachment } from '@/lib/actions/attachments';
import type { Attachment } from '@/lib/types';

export interface PendingFile {
  id: string;
  file: File;
  uploading: boolean;
  uploadError?: string;
}

interface FileUploadProps {
  /** Already-uploaded attachments to display */
  existingAttachments?: Attachment[];
  /** Called after a successful upload with the new attachment */
  onUploadComplete?: (attachment: Attachment) => void;
  /** Called after a successful delete */
  onDeleteComplete?: (attachmentId: string) => void;
  /** Entity context for server upload. If all three are provided, files are uploaded immediately. */
  entityType?: string;
  entityId?: string;
  projectId?: string;
  /** For creation flows where entity doesn't exist yet: track files locally */
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  /** Max file size in bytes (default 10MB) */
  maxFileSize?: number;
  /** Max number of files (default 20) */
  maxFiles?: number;
  /** Accepted file types */
  accept?: string;
  /** Title for the card */
  title?: string;
}

const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.dwg,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.heic';
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <ImageIcon className="size-4 text-blue-500" />;
  if (fileType === 'application/pdf') return <FileText className="size-4 text-red-500" />;
  return <FileIcon className="size-4 text-muted-foreground" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  existingAttachments = [],
  onUploadComplete,
  onDeleteComplete,
  entityType,
  entityId,
  projectId,
  pendingFiles,
  onPendingFilesChange,
  maxFileSize = DEFAULT_MAX_SIZE,
  maxFiles = 20,
  accept = DEFAULT_ACCEPT,
  title = 'Documents & Attachments',
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<PendingFile[]>([]);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  const canUploadToServer = !!(entityType && entityId && projectId);
  const isPendingMode = !!onPendingFilesChange;
  const totalCount = existingAttachments.length + (pendingFiles?.length ?? 0) + uploading.length;

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;

      const remaining = maxFiles - totalCount;
      const newFiles = Array.from(fileList).slice(0, remaining);

      // Validate file sizes
      const oversized = newFiles.filter((f) => f.size > maxFileSize);
      if (oversized.length > 0) {
        alert(
          `${oversized.length} file(s) exceed the ${formatSize(maxFileSize)} limit and were skipped.`
        );
      }
      const valid = newFiles.filter((f) => f.size <= maxFileSize);
      if (valid.length === 0) return;

      // Pending mode: just track files locally for later upload
      if (isPendingMode && onPendingFilesChange && pendingFiles) {
        onPendingFilesChange([...pendingFiles, ...valid]);
        return;
      }

      // Server upload mode
      if (!canUploadToServer) return;

      const pending: PendingFile[] = valid.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        uploading: true,
      }));

      setUploading((prev) => [...prev, ...pending]);

      for (const pf of pending) {
        try {
          const formData = new FormData();
          formData.append('file', pf.file);
          formData.append('entity_type', entityType!);
          formData.append('entity_id', entityId!);
          formData.append('project_id', projectId!);
          formData.append('photo_category', 'document');

          const result = await uploadAttachment(formData);

          if (result.error) {
            setUploading((prev) =>
              prev.map((f) =>
                f.id === pf.id ? { ...f, uploading: false, uploadError: result.error } : f
              )
            );
          } else {
            setUploading((prev) => prev.filter((f) => f.id !== pf.id));
            if (result.data) onUploadComplete?.(result.data);
          }
        } catch {
          setUploading((prev) =>
            prev.map((f) =>
              f.id === pf.id ? { ...f, uploading: false, uploadError: 'Upload failed' } : f
            )
          );
        }
      }
    },
    [
      canUploadToServer,
      entityType,
      entityId,
      projectId,
      isPendingMode,
      pendingFiles,
      onPendingFilesChange,
      onUploadComplete,
      maxFileSize,
      maxFiles,
      totalCount,
    ]
  );

  const handleDelete = useCallback(
    async (attachment: Attachment) => {
      if (!projectId) return;
      setDeleting((prev) => new Set(prev).add(attachment.id));

      const result = await deleteAttachment(attachment.id, projectId);

      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(attachment.id);
        return next;
      });

      if (!result.error) {
        onDeleteComplete?.(attachment.id);
      }
    },
    [projectId, onDeleteComplete]
  );

  const removePending = useCallback(
    (index: number) => {
      if (pendingFiles && onPendingFilesChange) {
        onPendingFilesChange(pendingFiles.filter((_, i) => i !== index));
      }
    },
    [pendingFiles, onPendingFilesChange]
  );

  const removeUploading = useCallback((id: string) => {
    setUploading((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-8 px-4 cursor-pointer transition-colors ${
            dragOver
              ? 'border-rc-blue bg-rc-blue/10'
              : 'border-rc-border hover:border-rc-blue/50 hover:bg-rc-blue/5'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Upload documents</p>
          <p className="text-xs text-muted-foreground">
            Drag & drop or click to browse. Max {formatSize(maxFileSize)} per file.
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, images, DWG, Excel, and more
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Existing attachments */}
        {existingAttachments.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Uploaded Files
            </p>
            {existingAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm group"
              >
                {getFileIcon(att.file_type)}
                <a
                  href={att.signed_url ?? att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium hover:underline flex-1"
                >
                  {att.file_name}
                </a>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(att.file_size)}
                </span>
                {projectId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                    disabled={deleting.has(att.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(att);
                    }}
                  >
                    {deleting.has(att.id) ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending files (creation flow) */}
        {pendingFiles && pendingFiles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Files to Upload
            </p>
            {pendingFiles.map((file, i) => (
              <div
                key={`pending-${i}-${file.name}`}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                {getFileIcon(file.type)}
                <span className="truncate font-medium flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-red-500"
                  onClick={() => removePending(i)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Uploading files */}
        {uploading.length > 0 && (
          <div className="space-y-1">
            {uploading.map((pf) => (
              <div
                key={pf.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                {pf.uploading ? (
                  <Loader2 className="size-4 animate-spin text-rc-blue" />
                ) : (
                  getFileIcon(pf.file.type)
                )}
                <span className="truncate font-medium flex-1">{pf.file.name}</span>
                {pf.uploadError && (
                  <span className="text-xs text-red-500 shrink-0">{pf.uploadError}</span>
                )}
                {!pf.uploading && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => removeUploading(pf.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Count */}
        {totalCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalCount} / {maxFiles} files
          </p>
        )}
      </CardContent>
    </Card>
  );
}
