'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, FilePenLine, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PendingWorkSignOutDialog({
  open,
  onOpenChange,
  operationCount,
  draftCount,
  failedCount,
  isOnline,
  isBusy,
  error,
  onSyncAndSignOut,
  onReviewDraft,
  onDiscardAndSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationCount: number;
  draftCount: number;
  failedCount: number;
  isOnline: boolean;
  isBusy: boolean;
  error: string | null;
  onSyncAndSignOut: () => void;
  onReviewDraft: () => void;
  onDiscardAndSignOut: () => void;
}) {
  const [discardArmed, setDiscardArmed] = useState(false);

  useEffect(() => {
    if (!open) setDiscardArmed(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" />
            Unsynchronized work is saved on this device
          </DialogTitle>
          <DialogDescription>
            Signing out removes this user&apos;s private offline database. RailCommand will not
            discard entered field work without your explicit confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
          {draftCount > 0 && (
            <p><strong>{draftCount}</strong> unfinished daily-log draft{draftCount === 1 ? '' : 's'}</p>
          )}
          {operationCount > 0 && (
            <p><strong>{operationCount}</strong> queued synchronization item{operationCount === 1 ? '' : 's'}</p>
          )}
          {failedCount > 0 && (
            <p className="text-destructive">
              {failedCount} item{failedCount === 1 ? ' needs' : 's need'} attention before {failedCount === 1 ? 'it' : 'they'} can synchronize.
            </p>
          )}
          {!isOnline && (
            <p className="text-amber-700 dark:text-amber-300">
              RailCommand is offline. Reconnect before choosing “Synchronize and sign out.”
            </p>
          )}
          {error && <p className="text-destructive" role="alert">{error}</p>}
        </div>

        {discardArmed && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
            This permanently removes the unfinished drafts, queued logs, and queued photos from this device.
            Select the discard button again only if you have intentionally chosen to lose this unsynchronized copy.
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Keep working
          </Button>
          {draftCount > 0 && (
            <Button variant="outline" onClick={onReviewDraft} disabled={isBusy}>
              <FilePenLine className="mr-2 size-4" />
              Review saved draft
            </Button>
          )}
          {draftCount === 0 && operationCount > 0 && (
            <Button onClick={onSyncAndSignOut} disabled={!isOnline || isBusy}>
              {isBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Synchronize and sign out
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={isBusy}
            onClick={() => {
              if (discardArmed) onDiscardAndSignOut();
              else setDiscardArmed(true);
            }}
          >
            <LogOut className="mr-2 size-4" />
            {discardArmed ? 'Confirm discard and sign out' : 'Discard offline work…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
