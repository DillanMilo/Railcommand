import type { Attachment, ProjectDocument } from '@/lib/types';
type Collections = { documents: ProjectDocument[]; photos: Attachment[] };

/** GET reads can run beside Server Actions instead of waiting in their client queue. */
export async function readProjectCollection<K extends keyof Collections>(collection: K, projectId: string): Promise<{ data?: Collections[K]; error?: string }> {
  try {
    const response = await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/${collection}`, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.data)) return { error: typeof result.error === 'string' ? result.error : `Could not load ${collection}. Please retry.` };
    return { data: result.data as Collections[K] };
  } catch {
    return { error: `Could not load ${collection}. Check your connection and retry.` };
  }
}
