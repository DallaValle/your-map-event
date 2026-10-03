import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const ATTENDEE_PROVIDERS = ["google", "facebook"] as const;
export type AttendeeProvider = (typeof ATTENDEE_PROVIDERS)[number];

export type ProviderProfile = {
  id: string;
  name: string;
  email: string | null;
  // Only a verified email may link to an existing attendee.
  emailVerified: boolean;
  image: string | null;
};

type ProviderConfig = {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  scope: string;
  token: (input: TokenInput) => Promise<string>;
  profile: (accessToken: string) => Promise<ProviderProfile>;
};

type TokenInput = { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`OAuth request failed with ${res.status}`);
  return res.json() as Promise<T>;
}

// Google reuses the organizer OAuth client; Facebook endpoints stay unversioned so the app default applies.
const PROVIDERS: Record<AttendeeProvider, ProviderConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    async token({ code, verifier, redirectUri, clientId, clientSecret }) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      return (await json<{ access_token: string }>(res)).access_token;
    },
    async profile(accessToken) {
      const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const p = await json<{ sub: string; name?: string; email?: string; email_verified?: boolean; picture?: string }>(res);
      return {
        id: p.sub,
        name: p.name || p.email?.split("@")[0] || "Google",
        email: p.email ?? null,
        emailVerified: p.email_verified === true,
        image: p.picture ?? null,
      };
    },
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    authorizeUrl: "https://www.facebook.com/dialog/oauth",
    scope: "email,public_profile",
    async token({ code, verifier, redirectUri, clientId, clientSecret }) {
      const url = new URL("https://graph.facebook.com/oauth/access_token");
      url.search = new URLSearchParams({
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString();
      return (await json<{ access_token: string }>(await fetch(url))).access_token;
    },
    async profile(accessToken) {
      const url = new URL("https://graph.facebook.com/me");
      url.search = new URLSearchParams({
        fields: "id,name,email,picture.width(160).height(160)",
        access_token: accessToken,
      }).toString();
      const p = await json<{ id: string; name?: string; email?: string; picture?: { data?: { url?: string; is_silhouette?: boolean } } }>(
        await fetch(url),
      );
      return {
        id: p.id,
        name: p.name || "Facebook",
        email: p.email ?? null,
        // Facebook only hands out confirmed emails.
        emailVerified: !!p.email,
        image: p.picture?.data?.is_silhouette ? null : (p.picture?.data?.url ?? null),
      };
    },
  },
};

export function isAttendeeProvider(value: string): value is AttendeeProvider {
  return (ATTENDEE_PROVIDERS as readonly string[]).includes(value);
}

/** Providers with credentials set; the sign-in sheet shows only these. */
export function enabledAttendeeProviders(): AttendeeProvider[] {
  return ATTENDEE_PROVIDERS.filter((p) => PROVIDERS[p].clientId && PROVIDERS[p].clientSecret);
}

export function redirectUriFor(provider: AttendeeProvider, origin: string) {
  return `${origin}/api/attendee-auth/${provider}/callback`;
}

/** Authorization URL plus the state and PKCE verifier to keep until the callback. */
export function authorizationRequest(provider: AttendeeProvider, redirectUri: string) {
  const config = PROVIDERS[provider];
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId!,
    redirect_uri: redirectUri,
    scope: config.scope,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...(provider === "google" && { prompt: "select_account" }),
  }).toString();
  return { url, state, verifier };
}

export async function fetchProviderProfile(
  provider: AttendeeProvider,
  { code, verifier, redirectUri }: { code: string; verifier: string; redirectUri: string },
) {
  const config = PROVIDERS[provider];
  const accessToken = await config.token({
    code,
    verifier,
    redirectUri,
    clientId: config.clientId!,
    clientSecret: config.clientSecret!,
  });
  return config.profile(accessToken);
}
