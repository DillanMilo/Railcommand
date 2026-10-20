import {
  operationalInventory,
  type InventoryCommand,
  type InventoryDraft,
  type InventoryResult,
  type InventorySnapshot,
} from "./inventory";
export interface InventoryPorts {
  userId: string;
  projectId: string;
  current(): boolean;
  uuid(): string;
  online(): boolean;
  read(): Promise<InventorySnapshot>;
  execute(id: string, command: InventoryCommand): Promise<InventoryResult>;
  receipt(id: string): Promise<InventoryResult | null>;
  readDraft(): Promise<InventoryDraft | null>;
  saveDraft(d: InventoryDraft): Promise<void>;
  deleteDraft(): Promise<void>;
  readCache(): Promise<InventorySnapshot | null>;
  cache(s: InventorySnapshot): Promise<void>;
}
export class InventoryController {
  snapshot: InventorySnapshot | null = null;
  draft: InventoryDraft | null = null;
  message = "Opening saved inventory…";
  busy = false;
  loaded = false;
  private listeners = new Set<() => void>();
  private saves: Promise<void> = Promise.resolve();
  private disposed = false;
  private readVersion = 0;
  constructor(private ports: InventoryPorts) {}
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private valid() {
    return !this.disposed && this.ports.current();
  }
  private changed() {
    if (this.valid()) for (const fn of this.listeners) fn();
  }
  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }
  async open() {
    this.disposed = false;
    try {
      const [d, c] = await Promise.all([
        this.ports.readDraft(),
        this.ports.readCache(),
      ]);
      if (!this.valid()) return;
      this.draft = d;
      this.snapshot = c ? operationalInventory(c) : null;
      this.loaded = true;
      this.message = d ? "Saved on this device" : "No saved request";
      this.changed();
      await this.refresh();
    } catch (e) {
      this.fail(e);
    }
  }
  private fail(e: unknown) {
    if (!this.valid()) return;
    this.message =
      e instanceof Error
        ? e.message
        : "Inventory unavailable. Saved work is preserved.";
    this.changed();
  }
  async refresh() {
    const readVersion = ++this.readVersion;
    if (this.snapshot) {
      this.snapshot = operationalInventory(this.snapshot);
      this.changed();
    }
    if (!this.ports.online()) {
      if (this.snapshot) this.snapshot = operationalInventory(this.snapshot);
      this.message =
        "Offline: saved quantities are read-only. Requests stay on this device; submission and approval require a connection.";
      this.changed();
      return;
    }
    try {
      const s = await this.ports.read();
      if (
        !this.valid() ||
        readVersion !== this.readVersion ||
        !this.ports.online()
      )
        return;
      this.snapshot = s;
      await this.ports.cache(operationalInventory(s));
      if (!this.valid() || readVersion !== this.readVersion) return;
      this.message =
        "Refreshed from server. Physical release requires final authorization.";
      this.changed();
    } catch (e) {
      this.fail(e);
    }
  }
  async edit(values: Record<string, unknown>) {
    if (!this.loaded || this.busy || this.draft?.phase === "unknown") return;
    const draft: InventoryDraft = {
      schemaVersion: 1,
      userId: this.ports.userId,
      projectId: this.ports.projectId,
      operationId: this.draft?.operationId ?? this.ports.uuid(),
      updatedAt: new Date().toISOString(),
      phase: "editing",
      command: { action: "submit", ...this.draft?.command, ...values },
    };
    this.draft = draft;
    this.message = "Saving on this device…";
    this.changed();
    const save = this.saves
      .catch(() => undefined)
      .then(async () => {
        if (!this.valid()) throw new Error("Account changed; save canceled");
        await this.ports.saveDraft(draft);
      });
    this.saves = save;
    try {
      await save;
      if (this.valid() && this.draft === draft) {
        this.message = "Saved on this device";
        this.changed();
      }
    } catch (e) {
      this.fail(e);
    }
  }
  async act(command?: InventoryCommand) {
    if (this.busy || !this.loaded) return;
    if (!this.ports.online()) {
      await this.refresh();
      return;
    }
    if (this.draft?.pending?.command.receiptOnly) {
      this.message =
        "This online-only decision retained its original receipt identity. Check the receipt or resolve this identity online without replay. Private input was not saved.";
      this.changed();
      return;
    }
    this.busy = true;
    this.changed();
    try {
      await this.saves;
      const base = this.draft ?? {
        schemaVersion: 1 as const,
        userId: this.ports.userId,
        projectId: this.ports.projectId,
        operationId: this.ports.uuid(),
        updatedAt: new Date().toISOString(),
        phase: "editing" as const,
        command: { action: "submit" as const },
      };
      const pending = this.draft?.pending ?? {
        operationId: command ? this.ports.uuid() : base.operationId,
        command: command ?? base.command,
      };
      this.draft = {
        ...base,
        phase: "unknown",
        pending,
        updatedAt: new Date().toISOString(),
      };
      await this.ports.saveDraft(this.draft);
      if (!this.valid()) return;
      this.message = "Checking server receipt. Input is preserved.";
      this.changed();
      const result = await this.ports.execute(
        pending.operationId,
        pending.command,
      );
      if (!this.valid()) return;
      if (result.code === "operation_conflict") {
        // A changed payload must never clear an accepted original operation.
        const original = await this.ports.receipt(pending.operationId);
        if (!this.valid()) return;
        if (original) await this.finish(original, pending.command);
        else {
          this.message = "Original receipt unavailable. Keep this identity and check again or resolve it online.";
          this.changed();
        }
      } else await this.finish(result, pending.command);
    } catch (e) {
      this.fail(e);
    } finally {
      if (this.valid()) {
        this.busy = false;
        this.changed();
      }
    }
  }
  private async finish(result: InventoryResult, command: InventoryCommand) {
    if (
      (result.ok && command.action === "submit") ||
      (this.draft && !this.draft.command.lotId && !this.draft.command.reason)
    ) {
      await this.ports.deleteDraft();
      if (!this.valid()) return;
      this.draft = null;
    } else if (this.draft) {
      const { pending: _pending, ...rest } = this.draft;
      this.draft = {
        ...rest,
        phase: "editing",
        operationId: this.ports.uuid(),
      };
      await this.ports.saveDraft(this.draft);
    }
    await this.refresh();
    if (!this.valid()) return;
    this.message = result.ok
      ? "Confirmed by server. Trail updated."
      : (result.error ?? "Operation denied; input remains saved.");
    this.changed();
  }
  /** Explicit settlement is serialized with the original delivery on the server.
   * Null receipt alone never permits abandonment, including old minimal envelopes.
   */
  async settle() {
    const pending = this.draft?.pending;
    if (!pending || this.busy || !this.ports.online()) return;
    this.busy = true;
    this.changed();
    try {
      await this.saves;
      if (!this.valid()) return;
      await this.ports.execute(pending.operationId, { action: "settle" });
      if (!this.valid()) return;
      // Only a durable receipt can unlock: denied/old-server/malformed responses
      // and a lost settlement response leave the same original pending identity.
      const result = await this.ports.receipt(pending.operationId);
      if (!this.valid()) return;
      if (result) await this.finish(result, pending.command);
      else {
        this.message = "Settlement not confirmed. Keep the original identity and check its receipt or resolve again online.";
        this.changed();
      }
    } catch (e) {
      this.fail(e);
    } finally {
      if (this.valid()) {
        this.busy = false;
        this.changed();
      }
    }
  }
  async recover() {
    const pending = this.draft?.pending;
    if (!pending || this.busy || !this.ports.online()) return;
    this.busy = true;
    this.changed();
    try {
      const result = await this.ports.receipt(pending.operationId);
      if (!this.valid()) return;
      if (result) await this.finish(result, pending.command);
      else {
        this.message =
          pending.command.receiptOnly
            ? "No receipt found yet for the original receipt identity. Resolve it online without replay to safely resume work; private input was not saved."
            : "No receipt found yet. Retry the saved operation safely with its original identity.";
        this.changed();
      }
    } catch (e) {
      this.fail(e);
    } finally {
      if (this.valid()) {
        this.busy = false;
        this.changed();
      }
    }
  }
}
