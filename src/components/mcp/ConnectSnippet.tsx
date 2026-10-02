"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("ai");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg active:scale-95"
    >
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

export function claudeCodeCommand(url: string, token: string) {
  return `claude mcp add --transport http your-map-event ${url} --header "Authorization: Bearer ${token}"`;
}

// Claude Desktop only launches local processes, so mcp-remote bridges to HTTP.
export function claudeDesktopConfig(url: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        "your-map-event": {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${AUTH_HEADER}"],
          env: { AUTH_HEADER: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

function Snippet({ title, hint, value, multiline }: { title: string; hint?: string; value: string; multiline?: boolean }) {
  const t = useTranslations("ai");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton value={value} label={t("copyLabel", { what: title })} />
      </div>
      {hint && <p className="text-xs opacity-60">{hint}</p>}
      <pre
        className={`overflow-x-auto rounded-xl bg-surface px-3 py-2.5 text-xs leading-relaxed ${
          multiline ? "" : "whitespace-pre-wrap break-all"
        }`}
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}

/** Endpoint plus ready to paste client configs, with a token placeholder. */
export function ConnectSnippet({ url, token = "<token>" }: { url: string; token?: string }) {
  const t = useTranslations("ai");
  return (
    <div className="flex flex-col gap-4">
      <Snippet title={t("endpoint")} hint={t("endpointHint")} value={url} />
      <Snippet title="Claude Code" value={claudeCodeCommand(url, token)} />
      <Snippet
        title="Claude Desktop"
        hint={t("desktopHint")}
        value={claudeDesktopConfig(url, token)}
        multiline
      />
    </div>
  );
}
