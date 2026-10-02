import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pageTitle } from "@/i18n/metadata";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { describeTools } from "@/lib/mcp/tools";
import { MCP_PROMPTS } from "@/lib/mcp/prompts";
import { ConnectSnippet } from "@/components/mcp/ConnectSnippet";
import { TokenManager } from "@/components/mcp/TokenManager";
import { ToolList } from "@/components/mcp/ToolList";

export const generateMetadata = pageTitle("ai");

async function publicOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">{title}</h2>
      <p className="mt-0.5 text-sm opacity-60">{hint}</p>
    </div>
  );
}

export default async function AiAssistantPage() {
  const membership = await getMyTeam();
  if (!membership) redirect("/dashboard");

  const { team, role } = membership;
  const isAdmin = isAdminRole(role);
  const endpoint = `${await publicOrigin()}/api/mcp/mcp`;

  const tokens = isAdmin
    ? await prisma.mcpToken.findMany({
        where: { teamId: team.id, revokedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">AI assistant</h1>
        <p className="text-sm opacity-70">
          Connect Claude (or any MCP client) to {team.name}. Attach a photo of your printed event
          map, and the assistant asks what is missing, then creates the event and places every
          point for you to review in the map editor.
        </p>
      </header>

      <section className="space-y-3">
        <SectionHeading
          title="Connect"
          hint={
            isAdmin
              ? "Paste one of these into your AI client, with a token from below in place of <token>."
              : "Paste one of these into your AI client. Tokens can edit events, so ask an admin of your team for one."
          }
        />
        <ConnectSnippet url={endpoint} />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <SectionHeading
            title="Access tokens"
            hint="Each token can edit every event of this team. Create one per client and revoke it when it is no longer used."
          />
          <TokenManager
            teamId={team.id}
            endpoint={endpoint}
            tokens={tokens.map((t) => ({
              id: t.id,
              name: t.name,
              prefix: t.prefix,
              createdByEmail: t.createdByEmail,
              createdAt: t.createdAt.toISOString(),
              lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading title="Tools" hint="What the assistant can do. Required parameters are marked with *." />
        <ToolList
          tools={describeTools()}
          prompts={MCP_PROMPTS.map(({ name, title, description }) => ({ name, title, description }))}
        />
      </section>
    </main>
  );
}
