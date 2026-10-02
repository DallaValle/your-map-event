"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient, useSession } from "@/lib/auth-client";
import { PendingLabel, Spinner } from "@/components/ui/Spinner";
import { BrandMark } from "@/components/nav/BrandMark";

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
  const t = useTranslations("invitation");
  const router = useRouter();
  const { data: session, isPending: sessionPending, refetch } = useSession();

  // Arriving from sign-up, the shared session store can still hold the
  // signed-out state if its refresh raced the redirect; ask once on landing.
  const refetchOnce = useRef(refetch);
  useEffect(() => {
    void refetchOnce.current();
  }, []);

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
          setError(t("invalid"));
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
      setError(t("acceptFailed"));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const redirect = encodeURIComponent(`/accept-invitation/${invitationId}`);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12 text-center">
      <div className="space-y-2">
        <BrandMark size={56} className="mx-auto" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {invitation ? (
          <p className="text-sm opacity-70">
            {t.rich(invitation.role === "admin" ? "invitedAdmin" : "invitedViewer", {
              inviter: invitation.inviterEmail,
              team: invitation.organizationName,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        ) : (
          <p className="text-sm opacity-70">
            {t("generic")}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {sessionPending ? (
        <p className="inline-flex items-center justify-center gap-2 text-sm opacity-60">
          <Spinner /> {t("checkingSession")}
        </p>
      ) : session ? (
        !error && (
          <button
            type="button"
            onClick={accept}
            disabled={accepting || !invitation}
            aria-busy={accepting}
            className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
          >
            <PendingLabel pending={accepting} label={t("join")} pendingLabel={t("joining")} />
          </button>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-70">
            {t("signInHint")}
          </p>
          <Link
            href={`/sign-in?redirect=${redirect}`}
            className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg active:scale-[.98]"
          >
            {t("signIn")}
          </Link>
          <Link
            href={`/sign-up?redirect=${redirect}`}
            className="rounded-xl border border-brand/40 px-6 py-3.5 font-semibold text-brand active:scale-[.98]"
          >
            {t("createAccount")}
          </Link>
        </div>
      )}
    </main>
  );
}
