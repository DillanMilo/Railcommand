import type { Attachment, ProjectDocument } from '@/lib/types';
export type Collections = { documents: ProjectDocument[]; photos: Attachment[] };

/** GET reads can run beside Server Actions instead of waiting in their client queue. */
export async function readProjectCollection<K extends keyof Collections>(collection: K, projectId: string, signal?: AbortSignal): Promise<{ data?: Collections[K]; error?: string }> {
  try {
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/${collection}`, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
    });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.data)) return { error: typeof result.error === 'string' ? result.error : `Could not load ${collection}. Please retry.` };
    return { data: result.data as Collections[K] };
  } catch {
    return { error: `Could not load ${collection}. Check your connection and retry.` };
  }
}

/** One signed-in provider owns this pool. Only unfinished requests are shared;
 * settled results, project records and signed URLs are never cached here. */
export function createProjectCollectionReader(scope = '') {
  const pending = new Map<string, { promise: Promise<unknown>; controller: AbortController }>();
  function read<K extends keyof Collections>(collection: K, projectId: string): ReturnType<typeof readProjectCollection<K>> {
    const key = `${scope}:${collection}:${projectId}`;
    const existing = pending.get(key);
    if (existing) return existing.promise as ReturnType<typeof readProjectCollection<K>>;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const promise = readProjectCollection(collection, projectId, controller.signal).finally(() => {
      clearTimeout(timeout);
      if (pending.get(key)?.controller === controller) pending.delete(key);
    });
    pending.set(key, { promise, controller });
    return promise;
  }
  return {
    read,
    clear() {
      for (const { controller } of pending.values()) controller.abort();
      pending.clear();
    },
  };
}
