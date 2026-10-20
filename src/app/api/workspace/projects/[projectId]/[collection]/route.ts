import { getProjectDocuments } from '@/lib/actions/documents';
import { getProjectPhotos } from '@/lib/actions/photos';
import { createClient } from '@/lib/supabase/server';
import { parsePhotoPageOptions } from '@/lib/project-photo-page';
import { getProjectPhotoPage, PhotoPageError } from '@/lib/project-photo-page-server';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' };

/** Read-only transport; existing actions still authenticate and enforce access. */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; collection: string }> }) {
  const { projectId, collection } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId) || !['documents', 'photos'].includes(collection)) {
    return Response.json({ error: 'Unknown project collection.' }, { status: 404, headers });
  }
  // Opt-in keeps the array response consumed by older web/mobile clients intact.
  const query = new URL(request.url).searchParams;
  if (collection === 'photos' && query.has('page')) {
    let options;
    try { options = parsePhotoPageOptions(query); }
    catch { return Response.json({ error: 'Invalid photo page.' }, { status: 400, headers }); }
    try {
      const { page, serverTiming } = await getProjectPhotoPage(await createClient(), projectId, options);
      return Response.json(page, { headers: { ...headers, 'Server-Timing': serverTiming } });
    } catch (error) {
      return Response.json({ error: error instanceof PhotoPageError ? error.message : 'Could not load photos. Please retry.' },
        { status: error instanceof PhotoPageError ? error.status : 503, headers });
    }
  }
  try {
    const result = collection === 'documents' ? await getProjectDocuments(projectId) : await getProjectPhotos(projectId);
    if (result.error || !result.data) return Response.json({ error: result.error || 'Could not load this collection.' }, { status: 403, headers });
    return Response.json({ data: result.data }, { headers });
  } catch {
    return Response.json({ error: 'Could not load this collection. Please retry.' }, { status: 503, headers });
  }
}
