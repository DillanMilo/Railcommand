type DraftSaver = () => Promise<void>;

// Only mounted forms register here. Draft values stay in the form/IndexedDB;
// this registry coordinates their pending writes before intentional sign-out.
const pendingDraftSavers = new Map<string, Set<DraftSaver>>();

export function registerPendingDraftSave(userId: string, save: DraftSaver): () => void {
  const savers = pendingDraftSavers.get(userId) ?? new Set<DraftSaver>();
  savers.add(save);
  pendingDraftSavers.set(userId, savers);
  return () => {
    savers.delete(save);
    if (savers.size === 0) pendingDraftSavers.delete(userId);
  };
}

export async function flushPendingDraftSaves(userId: string): Promise<void> {
  await Promise.all([...pendingDraftSavers.get(userId) ?? []].map((save) => save()));
}
