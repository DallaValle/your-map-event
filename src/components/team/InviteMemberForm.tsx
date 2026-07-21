"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

/**
 * Invite a teammate by email. No email provider is wired up, so the created
 * invitation is surfaced as a link the admin copies and sends themselves
 * (chat, email, however they like).
 */
export function InviteMemberForm({ orgId }: { orgId: string }) {
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
      setError(apiError?.message ?? "Could not create the invitation.");
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
          placeholder="teammate@company.com"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select name="role" defaultValue="member" className={inputClass} aria-label="Role">
          <option value="member">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {inviteLink && (
        <div className="flex flex-col gap-2 rounded-xl bg-teal-700/10 p-3">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
            ✓ Invitation created. Send this link to your teammate:
          </p>
          <div className="flex items-stretch gap-2">
            <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs dark:bg-neutral-900">
              {inviteLink}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white active:scale-95"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
