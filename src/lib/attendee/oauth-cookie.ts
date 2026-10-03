// Holds state, PKCE verifier and event across the provider round trip.
export const OAUTH_COOKIE = "yme_attendee_oauth";

export const oauthCookieOptions = {
  httpOnly: true,
  // Lax lets the cookie ride the top level redirect back from the provider.
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/attendee-auth",
  maxAge: 600,
};

export type OAuthCookie = { provider: string; state: string; verifier: string; eventId: string };

export function readOAuthCookie(raw: string | undefined): OAuthCookie | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthCookie>;
    return value.provider && value.state && value.verifier && value.eventId ? (value as OAuthCookie) : null;
  } catch {
    return null;
  }
}

// Set on the map URL after a failed provider round trip; the sign in sheet reopens with an error.
export const AUTH_ERROR_PARAM = "signin";
