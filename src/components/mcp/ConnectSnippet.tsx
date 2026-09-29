"use client";

import { useState } from "react";

export function CopyButton({ value, label }: { value: string; label: string }) {
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
      className="shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
    >
      {copied ? "✓ Copied" : "Copy"}
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton value={value} label={`Copy ${title}`} />
      </div>
      {hint && <p className="text-xs opacity-60">{hint}</p>}
      <pre
        className={`overflow-x-auto rounded-xl bg-black/5 px-3 py-2.5 text-xs leading-relaxed dark:bg-white/5 ${
          multiline ? "" : "whitespace-pre"
        }`}
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}

/** Endpoint plus ready to paste client configs, with a token placeholder. */
export function ConnectSnippet({ url, token = "<token>" }: { url: string; token?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Snippet title="Endpoint" hint="Streamable HTTP. Send the token as a Bearer Authorization header." value={url} />
      <Snippet title="Claude Code" value={claudeCodeCommand(url, token)} />
      <Snippet
        title="Claude Desktop"
        hint="Add to claude_desktop_config.json, then restart Claude Desktop."
        value={claudeDesktopConfig(url, token)}
        multiline
      />
    </div>
  );
}
