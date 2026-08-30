'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DAILY_LOG_CREATE_OPERATION,
  type OutboxOperation,
  type SyncHistoryItem,
} from '@/lib/offline/outbox';
import type { OfflineStorageEstimate } from '@/lib/offline/storage';

function operationLabel(operation: OutboxOperation): string {
  return operation.kind === DAILY_LOG_CREATE_OPERATION
    ? `Daily log ${operation.payload.log_date}`
    : operation.payload.fileName;
}

function statusLabel(operation: OutboxOperation): string {
  if (operation.status === 'failed') return 'Failed';
  if (operation.status === 'syncing') return 'Synchronizing';
  if (operation.status === 'retry') return 'Waiting to retry';
  return operation.kind === DAILY_LOG_CREATE_OPERATION ? 'Pending' : 'Pending photo';
}

export default function SyncCenter({
  operations,
  history,
  isSyncing,
  storageEstimate,
  onRetry,
}: {
  operations: OutboxOperation[];
  history: SyncHistoryItem[];
  isSyncing: boolean;
  storageEstimate: OfflineStorageEstimate | null;
  onRetry: () => void;
}) {
  const failedCount = operations.filter((operation) => operation.status === 'failed').length;
  const pendingCount = operations.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="fixed bottom-20 right-4 z-50 gap-2 rounded-full bg-background shadow-lg md:bottom-4"
          aria-label={`Open Sync Center. ${pendingCount} pending, ${failedCount} failed.`}
        >
          {failedCount > 0 ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : isSyncing ? (
            <Loader2 className="size-4 animate-spin text-rc-orange" />
          ) : pendingCount > 0 ? (
            <CloudUpload className="size-4 text-rc-orange" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-600" />
          )}
          Sync Center
          {pendingCount > 0 && <Badge variant="secondary">{pendingCount}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Center</DialogTitle>
          <DialogDescription>
            Daily logs synchronize before their photos. Every photo uploads and retries independently.
          </DialogDescription>
        </DialogHeader>

        {storageEstimate?.isNearlyFull && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
            <HardDrive className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Device storage is nearly full</p>
              <p className="mt-1 text-xs opacity-80">
                Approximately {(storageEstimate.usageRatio * 100).toFixed(0)}% of browser storage is in use. Synchronize pending photos and free device storage before entering more field work.
              </p>
            </div>
          </div>
        )}

        <section className="space-y-3" aria-labelledby="pending-sync-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pending-sync-heading" className="font-semibold">
              Pending and failed
            </h2>
            {failedCount > 0 && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw className="mr-1.5 size-3.5" />
                Retry failed
              </Button>
            )}
          </div>
          {operations.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Everything saved on this device has synchronized.
            </p>
          ) : (
            <div className="space-y-2">
              {operations.map((operation) => {
                const isLog = operation.kind === DAILY_LOG_CREATE_OPERATION;
                return (
                  <div key={operation.operationId} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      {isLog ? (
                        <FileText className="mt-0.5 size-4 shrink-0 text-rc-blue" />
                      ) : (
                        <ImageIcon className="mt-0.5 size-4 shrink-0 text-rc-orange" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{operationLabel(operation)}</p>
                          <Badge variant={operation.status === 'failed' ? 'destructive' : 'secondary'}>
                            {statusLabel(operation)}
                          </Badge>
                        </div>
                        {!isLog && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Compressed to {(operation.payload.fileSize / 1024).toFixed(0)} KB
                            {operation.payload.originalSize > operation.payload.fileSize
                              ? ` from ${(operation.payload.originalSize / 1024).toFixed(0)} KB`
                              : ''}
                          </p>
                        )}
                        {operation.lastError && (
                          <p className="mt-1 text-xs text-destructive">{operation.lastError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="synchronized-heading">
          <h2 id="synchronized-heading" className="font-semibold">Recently synchronized</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items have synchronized on this device yet.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {history.slice(0, 20).map((item) => (
                <div key={item.operationId} className="flex items-center gap-3 p-3">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.completedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">Synchronized</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
