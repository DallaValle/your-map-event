"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createMcpTokenAction,
  revokeMcpTokenAction,
  type CreateTokenState,
} from "@/actions/mcp-tokens";
import { claudeCodeCommand, CopyButton } from "./ConnectSnippet";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

export interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  createdByEmail: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function RevokeButton({ token }: { token: TokenRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`Revoke ${token.name}`}
        onClick={() => {
          if (!window.confirm(`Revoke "${token.name}"? Clients using it stop working immediately.`)) return;
          startTransition(async () => {
            const result = await revokeMcpTokenAction(token.id);
            setError(result && !result.ok ? result.error : null);
          });
        }}
        className="rounded-lg border border-red-600/30 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60 dark:text-red-400"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Admin only: create team tokens (raw value shown once), list and revoke. */
export function TokenManager({ teamId, tokens, endpoint }: { teamId: string; tokens: TokenRow[]; endpoint: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<CreateTokenState, FormData>(
    createMcpTokenAction.bind(null, teamId),
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={formAction} className="flex flex-wrap gap-2">
        <input
          name="name"
          required
          maxLength={60}
          aria-label="Token name"
          placeholder="e.g. Claude Desktop on my laptop"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 active:scale-[.98]"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div role="status" className="flex flex-col gap-3 rounded-xl bg-teal-700/10 p-3">
          <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
            ✓ Token “{state.name}” created. Copy it now: it is not shown again.
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid="new-mcp-token"
              className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs dark:bg-neutral-900"
            >
              {state.token}
            </code>
            <CopyButton value={state.token} label="Copy token" />
          </div>
          <div className="flex items-center gap-2">
            <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs dark:bg-neutral-900">
              {claudeCodeCommand(endpoint, state.token)}
            </code>
            <CopyButton value={claudeCodeCommand(endpoint, state.token)} label="Copy Claude Code command" />
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 px-4 py-6 text-center text-sm opacity-60 dark:border-white/25">
          No active tokens yet.
        </p>
      ) : (
        <ul
          aria-label="Active tokens"
          className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15"
        >
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{token.name}</p>
                <p className="truncate text-xs opacity-60">
                  <code>{token.prefix}…</code> · by {token.createdByEmail} · {DATE.format(new Date(token.createdAt))} ·{" "}
                  {token.lastUsedAt ? `last used ${DATE.format(new Date(token.lastUsedAt))}` : "never used"}
                </p>
              </div>
              <RevokeButton token={token} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
