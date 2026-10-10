/**
 * Which API paths the same-origin gateway (/api/proxy) will forward. The API still enforces roles on every route;
 * this list only keeps the browser from reaching routes the web UI never uses (health, docs, auth/login, ...).
 */
const ALLOWED: RegExp[] = [
  /^admin(\/[A-Za-z0-9_-]+){1,4}$/,
  /^requests(\/[A-Za-z0-9_-]+){0,3}$/,
  /^technicians\/me\/(availability|location)$/,
  /^users\/me$/,
  /^auth\/me$/,
];

/** `segments` is the decoded catch-all path. Empty, dot and separator-bearing segments are always refused. */
export function isAllowedGatewayPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((s) => s === '' || s === '.' || s === '..' || /[\/%\0]/.test(s))) return false;
  const path = segments.join('/');
  return ALLOWED.some((re) => re.test(path));
}
