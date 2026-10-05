import { getProjectDocuments } from '@/lib/actions/documents';
import { getProjectPhotos } from '@/lib/actions/photos';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' };

/** Read-only transport; existing actions still authenticate and enforce access. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; collection: string }> }) {
  const { projectId, collection } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId) || !['documents', 'photos'].includes(collection)) {
    return Response.json({ error: 'Unknown project collection.' }, { status: 404, headers });
  }
  try {
    const result = collection === 'documents' ? await getProjectDocuments(projectId) : await getProjectPhotos(projectId);
    if (result.error || !result.data) return Response.json({ error: result.error || 'Could not load this collection.' }, { status: 403, headers });
    return Response.json({ data: result.data }, { headers });
  } catch {
    return Response.json({ error: 'Could not load this collection. Please retry.' }, { status: 503, headers });
  }
}
