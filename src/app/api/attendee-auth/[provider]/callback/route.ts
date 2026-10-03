import { NextResponse, type NextRequest } from "next/server";
import { attendeeFromProvider, findLiveEvent } from "@/lib/attendee/accounts";
import { fetchProviderProfile, isAttendeeProvider, redirectUriFor } from "@/lib/attendee/oauth";
import { AUTH_ERROR_PARAM, OAUTH_COOKIE, oauthCookieOptions, readOAuthCookie } from "@/lib/attendee/oauth-cookie";
import { createAttendeeSession, sessionCookieName, sessionCookieOptions } from "@/lib/attendee/session";

/** Provider redirect target: signs the attendee in and returns them to the event map. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = request.nextUrl.searchParams;
  const saved = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const event = saved ? await findLiveEvent(saved.eventId) : null;
  if (!saved || !event) return NextResponse.redirect(new URL("/", request.url));

  const back = new URL(event.path, request.url);
  const code = query.get("code");
  const valid = isAttendeeProvider(provider) && saved.provider === provider && query.get("state") === saved.state;

  let token: { token: string; maxAge: number } | null = null;
  if (valid && code) {
    try {
      const profile = await fetchProviderProfile(provider, {
        code,
        verifier: saved.verifier,
        redirectUri: redirectUriFor(provider, request.nextUrl.origin),
      });
      token = await createAttendeeSession(await attendeeFromProvider(event.id, provider, profile));
    } catch (error) {
      console.error("attendee oauth callback failed", error);
    }
  }
  // A cancelled consent screen lands here too, with no code.
  if (!token) back.searchParams.set(AUTH_ERROR_PARAM, "failed");

  const response = NextResponse.redirect(back);
  response.cookies.set(OAUTH_COOKIE, "", { ...oauthCookieOptions, maxAge: 0 });
  if (token) response.cookies.set(sessionCookieName(event.id), token.token, sessionCookieOptions(token.maxAge));
  return response;
}
