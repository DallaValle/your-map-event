"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Copy-link + revoke controls for one pending invitation. */
export function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/accept-invitation/${invitationId}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function cancel() {
    startTransition(async () => {
      await authClient.organization.cancelInvitation({ invitationId });
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/5"
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? "…" : "Revoke"}
      </button>
    </div>
  );
}
