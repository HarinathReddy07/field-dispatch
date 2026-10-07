/** Reads `exp` (epoch seconds) from a JWT payload WITHOUT verifying it. Only used to decide when to refresh. */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}
