import { useTranslations } from "next-intl";
import type { ToolParam } from "@/lib/mcp/tools";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

export interface ToolDoc {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  params: ToolParam[];
}

export interface PromptDoc {
  name: string;
  title: string;
  description: string;
}

function ParamsTable({ params }: { params: ToolParam[] }) {
  const t = useTranslations("ai");
  if (params.length === 0) return <p className="text-xs opacity-60">{t("noParams")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="opacity-60">
          <tr>
            <th className="py-1.5 pr-3 font-medium">{t("param")}</th>
            <th className="hidden py-1.5 pr-3 font-medium sm:table-cell">{t("type")}</th>
            <th className="hidden py-1.5 font-medium sm:table-cell">{t("description")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {params.map((p) => (
            <tr key={p.name} className="align-top">
              <td className="py-1.5 pr-3 font-mono sm:whitespace-nowrap">
                {p.name}
                {p.required && (
                  <span className="ml-0.5 text-danger" title={t("required")} aria-label={t("required")}>
                    *
                  </span>
                )}
                {/* Narrow screens stack type and description under the name. */}
                <span className="block opacity-60 sm:hidden">{p.type}</span>
                {p.description && (
                  <span className="mt-0.5 block font-sans opacity-80 sm:hidden">{p.description}</span>
                )}
              </td>
              <td className="hidden py-1.5 pr-3 font-mono whitespace-nowrap opacity-70 sm:table-cell">{p.type}</td>
              <td className="hidden py-1.5 opacity-80 sm:table-cell">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Rendered from the MCP registry, so it always matches the live server. */
export function ToolList({ tools, prompts }: { tools: ToolDoc[]; prompts: PromptDoc[] }) {
  const t = useTranslations("ai");
  return (
    <div className="flex flex-col gap-4">
      {prompts.map((prompt) => (
        <div key={prompt.name} className="rounded-2xl border-2 border-brand/30 bg-brand-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{t("prompt")}</p>
          <h3 className="mt-1 font-semibold">
            {prompt.title} <code className="ml-1 text-xs font-normal opacity-60">{prompt.name}</code>
          </h3>
          <p className="mt-1 text-sm opacity-70">{prompt.description}</p>
        </div>
      ))}

      <ul aria-label={t("mcpTools")} className="divide-y divide-line rounded-2xl border border-line">
        {tools.map((tool) => (
          <li key={tool.name}>
            <details className="group px-4 py-3" data-tool={tool.name}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">
                    <code className="text-sm">{tool.name}</code>
                    <span className="ml-2 text-sm font-normal opacity-60">{tool.title}</span>
                  </p>
                  <p className="mt-0.5 text-sm opacity-70">{tool.description}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium">
                    {tool.readOnly ? t("read") : t("write")}
                  </span>
                  <Icon icon={ChevronRight} size="sm" className="opacity-50 transition-transform group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-3">
                <ParamsTable params={tool.params} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
