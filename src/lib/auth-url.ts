/**
 * Better Auth throws at module init if BETTER_AUTH_URL is set but not a valid
 * absolute http(s) URL (e.g. a redacted placeholder from `vercel pull`).
 * Drop junk so the client can fall back to the request origin / relative path.
 */
export function sanitizeBetterAuthUrlEnv(): void {
  const keys = [
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_BETTER_AUTH_URL",
    "PUBLIC_BETTER_AUTH_URL",
  ] as const;

  for (const key of keys) {
    const raw = process.env[key];
    if (raw == null || raw === "") continue;
    if (isValidAuthBaseUrl(raw)) continue;
    delete process.env[key];
  }
}

export function isValidAuthBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
