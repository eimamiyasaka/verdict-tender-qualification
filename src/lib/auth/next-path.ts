/**
 * Sanitises the `?next=` parameter that survives a redirect through /login and
 * /auth/callback.
 *
 * Only a same-origin, root-relative path is allowed. `//evil.test` and
 * `https://evil.test` are both rejected: the first is a protocol-relative URL
 * that browsers treat as absolute, and an open redirect on a sign-in flow is
 * how a convincing phishing page gets a real domain in front of it.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
