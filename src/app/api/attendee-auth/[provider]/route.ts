import { NextResponse, type NextRequest } from "next/server";
import { findLiveEvent } from "@/lib/attendee/accounts";
import { authorizationRequest, enabledAttendeeProviders, isAttendeeProvider, redirectUriFor } from "@/lib/attendee/oauth";
import { OAUTH_COOKIE, oauthCookieOptions } from "@/lib/attendee/oauth-cookie";

/** Starts Google or Facebook sign in for one event's live map. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const event = await findLiveEvent(request.nextUrl.searchParams.get("event") ?? "");
  if (!event || !isAttendeeProvider(provider) || !enabledAttendeeProviders().includes(provider)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const redirectUri = redirectUriFor(provider, request.nextUrl.origin);
  const { url, state, verifier } = authorizationRequest(provider, redirectUri);
  const response = NextResponse.redirect(url);
  response.cookies.set(
    OAUTH_COOKIE,
    JSON.stringify({ provider, state, verifier, eventId: event.id }),
    oauthCookieOptions,
  );
  return response;
}
