import {
  inventoryDeviceDraft,
  parseInventoryDraft,
  operationalInventory,
  type InventoryDraft,
  type InventorySnapshot,
} from "@railcommand/domain";
import {
  OFFLINE_DATA_CLEARING_EVENT,
  OFFLINE_SCOPE_STORAGE_KEY,
  getOfflineDatabaseName,
  openOfflineDatabase,
  OFFLINE_STORES,
} from "@/lib/offline/storage";
const epochs = new Map<string, number>();
if (typeof window !== "undefined")
  window.addEventListener(OFFLINE_DATA_CLEARING_EVENT, (event) => {
    const user = (event as CustomEvent<{ userId: string }>).detail?.userId;
    if (user) epochs.set(user, (epochs.get(user) ?? 0) + 1);
  });
export async function inventoryDeviceTransaction<T>(
  userId: string,
  storeName: "drafts" | "records",
  mode: IDBTransactionMode,
  work: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (error: unknown) => void,
  ) => void,
): Promise<T> {
  const epoch = epochs.get(userId) ?? 0;
  const current = () => epoch === (epochs.get(userId) ?? 0);
  const db = await openOfflineDatabase(userId);
  try {
    try {
      localStorage.setItem(
        OFFLINE_SCOPE_STORAGE_KEY,
        getOfflineDatabaseName(userId),
      );
    } catch {}
    if (!current())
      throw new Error(
        "Account storage was cleared; old device operation canceled",
      );
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORES[storeName], mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error("Device storage failed"));
      tx.onabort = () =>
        reject(tx.error ?? new Error("Device storage transaction aborted"));
      work(
        tx.objectStore(OFFLINE_STORES[storeName]),
        (v) => {
          result = v;
        },
        reject,
      );
    });
  } finally {
    db.close();
  }
}
export async function saveInventoryDraft(draft: InventoryDraft): Promise<void> {
  if (!parseInventoryDraft(draft, draft.userId, draft.projectId))
    throw new Error(
      "Unsupported inventory draft. Original saved work was retained.",
    );
  await inventoryDeviceTransaction<void>(
    draft.userId,
    "drafts",
    "readwrite",
    (s, done) => {
      s.put({
        draftId: `inventory:${draft.projectId}`,
        kind: "inventory",
        projectId: draft.projectId,
        updatedAt: draft.updatedAt,
        value: inventoryDeviceDraft(draft),
      });
      done();
    },
  );
}
export async function readInventoryDraft(
  userId: string,
  projectId: string,
): Promise<InventoryDraft | null> {
  return inventoryDeviceTransaction(
    userId,
    "drafts",
    "readwrite",
    (s, done, reject) => {
      const r = s.get(`inventory:${projectId}`);
      r.onsuccess = () => {
        const raw = r.result?.value;
        if (raw && !parseInventoryDraft(raw, userId, projectId))
          return reject(
            new Error(
              "Saved inventory draft needs a supported app version. It has not been deleted.",
            ),
          );
        const parsed = parseInventoryDraft(raw, userId, projectId);
        const safe = parsed ? inventoryDeviceDraft(parsed) : null;
        if (safe && JSON.stringify(safe) !== JSON.stringify(raw))
          s.put({ ...r.result, value: safe });
        done(safe);
      };
    },
  );
}
export async function removeInventoryDraft(
  userId: string,
  projectId: string,
): Promise<void> {
  await inventoryDeviceTransaction<void>(
    userId,
    "drafts",
    "readwrite",
    (s, done) => {
      s.delete(`inventory:${projectId}`);
      done();
    },
  );
}
export async function cacheInventory(
  userId: string,
  snapshot: InventorySnapshot,
): Promise<void> {
  await inventoryDeviceTransaction<void>(
    userId,
    "records",
    "readwrite",
    (s, done) => {
      s.put({
        key: `inventory:${snapshot.projectId}`,
        projectId: snapshot.projectId,
        entityType: "inventory",
        value: operationalInventory(snapshot),
        cachedAt: snapshot.asOf,
      });
      done();
    },
  );
}
export async function readCachedInventory(
  userId: string,
  projectId: string,
): Promise<InventorySnapshot | null> {
  return inventoryDeviceTransaction(
    userId,
    "records",
    "readwrite",
    (s, done) => {
      const r = s.get(`inventory:${projectId}`);
      r.onsuccess = () => {
        const raw = r.result?.value;
        const safe = raw ? operationalInventory(raw) : null;
        if (safe && JSON.stringify(safe) !== JSON.stringify(raw))
          s.put({ ...r.result, value: safe });
        done(safe);
      };
    },
  );
}
/** Includes existing daily-log/photo work without changing or clearing any item. */
export async function inspectWebDeviceWork(userId: string): Promise<number> {
  const db = await openOfflineDatabase(userId);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["drafts", "outbox"], "readonly");
      let total = 0;
      for (const name of ["drafts", "outbox"]) {
        const r = tx.objectStore(name).count();
        r.onsuccess = () => {
          total += r.result;
        };
      }
      tx.oncomplete = () => resolve(total);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Remove legacy financial cache fields selectively; outbox/draft/blob stores are never touched. */
export async function sanitizeOfflineFinance(userId: string): Promise<void> {
  await inventoryDeviceTransaction<void>(
    userId,
    "records",
    "readwrite",
    (store, done, reject) => {
      const cursor = store.openCursor();
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) {
          done();
          return;
        }
        const record = row.value;
        if (
          record.entityType === "project" &&
          record.value &&
          typeof record.value === "object"
        ) {
          const {
            budget_total: _total,
            budget_spent: _spent,
            budgetTotal: _camelTotal,
            budgetSpent: _camelSpent,
            ...safe
          } = record.value;
          row.update({ ...record, value: safe });
        } else if (record.entityType === "inventory" && record.value)
          row.update({ ...record, value: operationalInventory(record.value) });
        row.continue();
      };
    },
  );
}
