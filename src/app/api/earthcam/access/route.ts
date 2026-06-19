import { NextRequest, NextResponse } from 'next/server';
import { readEarthCamAccessToken } from '@/lib/earthcam/security';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const payload = readEarthCamAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Expired or invalid EarthCam access link' }, { status: 403 });
  }

  const response = NextResponse.redirect(payload.url, { status: 302 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
