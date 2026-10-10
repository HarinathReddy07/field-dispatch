import { NextRequest, NextResponse } from 'next/server';
import { isAllowedGatewayPath } from '@/lib/gateway';
import { apiUrl, ensureAccessToken, refreshSession } from '@/lib/session';

/**
 * Same-origin gateway to the API: attaches the bearer from the httpOnly cookie (refreshing once on 401).
 * Only the routes the web UI uses are reachable (see lib/gateway.ts); the API enforces roles on each of them.
 */
type Ctx = { params: Promise<{ path: string[] }> };

const FORWARDED = ['idempotency-key'] as const;

async function forward(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  if (!isAllowedGatewayPath(path)) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Resource not found' }, { status: 404 });
  }
  const target = path.join('/');
  let token = await ensureAccessToken();
  if (!token)
    return NextResponse.json(
      { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      { status: 401 },
    );

  const body = req.method === 'GET' ? undefined : await req.text();
  const extra: Record<string, string> = {};
  for (const h of FORWARDED) {
    const v = req.headers.get(h);
    if (v) extra[h] = v;
  }
  const call = (t: string) =>
    fetch(`${apiUrl(target)}${req.nextUrl.search}`, {
      method: req.method,
      headers: {
        ...extra,
        authorization: `Bearer ${t}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        'x-correlation-id': req.headers.get('x-correlation-id') ?? crypto.randomUUID(),
      },
      body,
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await call(token);
    if (res.status === 401) {
      token = await refreshSession();
      if (token) res = await call(token);
    }
  } catch {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'API unreachable' }, { status: 503 });
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
      ...(res.headers.get('x-correlation-id')
        ? { 'x-correlation-id': res.headers.get('x-correlation-id')! }
        : {}),
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
