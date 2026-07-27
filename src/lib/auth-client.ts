"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { sanitizeBetterAuthUrlEnv } from "@/lib/auth-url";

// Drop invalid BETTER_AUTH_URL before createAuthClient reads env (prerender).
sanitizeBetterAuthUrlEnv();

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
