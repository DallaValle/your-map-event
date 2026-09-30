import type { ToolParam } from "@/lib/mcp/tools";

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
  if (params.length === 0) return <p className="text-xs opacity-60">No parameters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="opacity-60">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Parameter</th>
            <th className="hidden py-1.5 pr-3 font-medium sm:table-cell">Type</th>
            <th className="hidden py-1.5 font-medium sm:table-cell">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {params.map((p) => (
            <tr key={p.name} className="align-top">
              <td className="py-1.5 pr-3 font-mono sm:whitespace-nowrap">
                {p.name}
                {p.required && (
                  <span className="ml-0.5 text-red-600 dark:text-red-400" title="Required" aria-label="required">
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
  return (
    <div className="flex flex-col gap-4">
      {prompts.map((prompt) => (
        <div key={prompt.name} className="rounded-2xl border-2 border-teal-700/30 bg-teal-700/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">Prompt</p>
          <h3 className="mt-1 font-semibold">
            {prompt.title} <code className="ml-1 text-xs font-normal opacity-60">{prompt.name}</code>
          </h3>
          <p className="mt-1 text-sm opacity-70">{prompt.description}</p>
        </div>
      ))}

      <ul aria-label="MCP tools" className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
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
                  <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium dark:bg-white/10">
                    {tool.readOnly ? "Read" : "Write"}
                  </span>
                  <span aria-hidden className="text-xs opacity-50 transition-transform group-open:rotate-90">
                    ▶
                  </span>
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
