import { NextRequest, NextResponse } from 'next/server';
import { apiUrl, ensureAccessToken, refreshSession } from '@/lib/session';

/**
 * Same-origin gateway to the admin API: attaches the bearer from the httpOnly cookie (refreshing once on 401).
 * Only `admin/*` is reachable, so this can't be used to call arbitrary API routes from the browser.
 */
type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const target = path.join('/');
  if (path.some((p) => p === '..' || p === '.') || !target.startsWith('admin/')) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Resource not found' }, { status: 404 });
  }
  let token = await ensureAccessToken();
  if (!token)
    return NextResponse.json(
      { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      { status: 401 },
    );

  const body = req.method === 'GET' ? undefined : await req.text();
  const call = (t: string) =>
    fetch(`${apiUrl(target)}${req.nextUrl.search}`, {
      method: req.method,
      headers: {
        authorization: `Bearer ${t}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        'x-correlation-id': req.headers.get('x-correlation-id') ?? crypto.randomUUID(),
      },
      body,
      cache: 'no-store',
    });

  let res = await call(token);
  if (res.status === 401) {
    token = await refreshSession();
    if (token) res = await call(token);
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export const GET = forward;
export const POST = forward;
