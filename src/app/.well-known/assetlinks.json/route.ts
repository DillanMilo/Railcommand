import { androidAssetLinks } from '@/lib/mobile-link-associations';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  const association = androidAssetLinks(request.headers.get('host'));
  if (!association) return new Response('Not found', { status: 404 });
  return Response.json(association, {
    headers: { 'Cache-Control': 'public, max-age=300', 'Content-Type': 'application/json' },
  });
}
