"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createMcpTokenAction,
  revokeMcpTokenAction,
  type CreateTokenState,
} from "@/actions/mcp-tokens";
import { claudeCodeCommand, CopyButton } from "./ConnectSnippet";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";

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
        className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
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
          className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div role="status" className="flex flex-col gap-3 rounded-xl bg-brand-soft p-3">
          <p className="text-sm font-medium text-brand">
            ✓ Token “{state.name}” created. Copy it now: it is not shown again.
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid="new-mcp-token"
              className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-3 py-2 text-xs"
            >
              {state.token}
            </code>
            <CopyButton value={state.token} label="Copy token" />
          </div>
          <div className="flex items-center gap-2">
            <code className="flex min-w-0 flex-1 items-center break-all rounded-lg bg-surface px-3 py-2 text-xs">
              {claudeCodeCommand(endpoint, state.token)}
            </code>
            <CopyButton value={claudeCodeCommand(endpoint, state.token)} label="Copy Claude Code command" />
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No active tokens yet.
        </p>
      ) : (
        <ul
          aria-label="Active tokens"
          className="divide-y divide-line rounded-2xl border border-line"
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
