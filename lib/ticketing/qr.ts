// QR check-in helpers — pure, framework-free, unit-testable.
//
// A ticket QR encodes the door check-in URL:
//   <frontend>/band/tickets/check-in?token=<public_token>
// …but hardware scanners or older QRs may carry a bare code/token. We accept
// both: pull `token` out of a URL, otherwise treat the value as the token.

/**
 * Extract the ticket token from a decoded QR value.
 *
 * - Full check-in URL  → returns the `token` query param.
 * - URL without token   → returns null (nothing usable).
 * - Bare code/token     → returns the trimmed value as-is.
 * - Empty / whitespace  → returns null.
 */
export function extractToken(decoded: string | null | undefined): string | null {
  if (!decoded) return null;
  const raw = decoded.trim();
  if (!raw) return null;

  // Looks like a URL? Parse and read ?token=. We only treat http(s) (and
  // protocol-relative) values as URLs so a bare token that happens to contain
  // a slash isn't mistaken for one.
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    try {
      const url = new URL(raw, 'https://placeholder.invalid');
      const token = url.searchParams.get('token');
      return token && token.trim() ? token.trim() : null;
    } catch {
      return null;
    }
  }

  // Bare code/token — use as-is.
  return raw;
}
