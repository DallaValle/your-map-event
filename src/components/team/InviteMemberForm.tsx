"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { PendingLabel } from "@/components/ui/Spinner";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

/**
 * Invite a teammate by email. No email provider is wired up, so the created
 * invitation is surfaced as a link the admin copies and sends themselves
 * (chat, email, however they like).
 */
export function InviteMemberForm({ orgId }: { orgId: string }) {
  const t = useTranslations("team");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteLink(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const role = form.get("role") === "admin" ? "admin" : "member";

    const { data, error: apiError } = await authClient.organization.inviteMember({
      email,
      role,
      organizationId: orgId,
    });

    setPending(false);

    if (apiError || !data) {
      setError(apiError?.message ?? t("inviteFailed"));
      return;
    }

    setInviteLink(`${window.location.origin}/accept-invitation/${data.id}`);
    event.currentTarget?.reset?.();
    router.refresh();
  }

  async function copy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select name="role" defaultValue="member" className={inputClass} aria-label={t("role")}>
          <option value="member">{t("viewer")}</option>
          <option value="admin">{t("admin")}</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
        >
          <PendingLabel pending={pending} label={t("inviteButton")} pendingLabel={t("inviting")} />
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {inviteLink && (
        <div className="flex flex-col gap-2 rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-medium text-brand">
            {t("inviteCreated")}
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs dark:bg-neutral-900">
              {inviteLink}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg active:scale-95"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
