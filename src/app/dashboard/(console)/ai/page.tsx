import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("ai");
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
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm opacity-70">{t("intro", { team: team.name })}</p>
      </header>

      <section className="space-y-3">
        <SectionHeading
          title={t("connect")}
          hint={isAdmin ? t("connectHintAdmin") : t("connectHintViewer")}
        />
        <ConnectSnippet url={endpoint} />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <SectionHeading
            title={t("tokens")}
            hint={t("tokensHint")}
          />
          <TokenManager
            teamId={team.id}
            endpoint={endpoint}
            tokens={tokens.map((token) => ({
              id: token.id,
              name: token.name,
              prefix: token.prefix,
              createdByEmail: token.createdByEmail,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading title={t("tools")} hint={t("toolsHint")} />
        <ToolList
          tools={describeTools()}
          prompts={MCP_PROMPTS.map(({ name, title, description }) => ({ name, title, description }))}
        />
      </section>
    </main>
  );
}
