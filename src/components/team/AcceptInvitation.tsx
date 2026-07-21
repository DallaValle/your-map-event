"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

interface InvitationDetails {
  organizationName: string;
  inviterEmail: string;
  role: string;
  email: string;
}

/**
 * Landing page for an invite link. Signed-out visitors are routed through
 * sign-in/sign-up (with a redirect back here); signed-in visitors see who
 * invited them and accept with one click.
 */
export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // The invitation is only readable by the invited user, so fetch it once a
  // session exists. Errors (expired, wrong account) surface inline.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        if (apiError || !data) {
          setError(
            apiError?.message ??
              "This invitation is invalid or has expired. Ask for a new link.",
          );
          return;
        }
        setInvitation(data);
      });
    return () => {
      cancelled = true;
    };
  }, [session, invitationId]);

  async function accept() {
    setAccepting(true);
    setError(null);
    const { error: apiError } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (apiError) {
      setAccepting(false);
      setError(apiError.message ?? "Could not accept the invitation.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const redirect = encodeURIComponent(`/accept-invitation/${invitationId}`);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12 text-center">
      <div className="space-y-2">
        <span className="text-4xl" aria-hidden>
          💌
        </span>
        <h1 className="text-2xl font-bold">Team invitation</h1>
        {invitation ? (
          <p className="text-sm opacity-70">
            <strong>{invitation.inviterEmail}</strong> invited you to join{" "}
            <strong>{invitation.organizationName}</strong> as{" "}
            {invitation.role === "admin" ? "an Admin" : "a Viewer"}.
          </p>
        ) : (
          <p className="text-sm opacity-70">
            You have been invited to collaborate on event maps.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {sessionPending ? (
        <p className="text-sm opacity-60">Checking your session…</p>
      ) : session ? (
        !error && (
          <button
            type="button"
            onClick={accept}
            disabled={accepting || !invitation}
            className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
          >
            {accepting ? "Joining…" : "Join the team"}
          </button>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-70">
            Sign in with the email address the invitation was sent to.
          </p>
          <Link
            href={`/sign-in?redirect=${redirect}`}
            className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white active:scale-[.98]"
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?redirect=${redirect}`}
            className="rounded-xl border border-teal-700/40 px-6 py-3.5 font-semibold text-teal-700 active:scale-[.98] dark:text-teal-400"
          >
            Create an account
          </Link>
        </div>
      )}
    </main>
  );
}
