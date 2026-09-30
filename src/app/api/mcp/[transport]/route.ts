import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { contextFromAuth, verifyMcpToken } from "@/lib/mcp/auth";
import { ToolError } from "@/lib/mcp/errors";
import { MCP_PROMPTS } from "@/lib/mcp/prompts";
import { MCP_TOOLS } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const handler = createMcpHandler(
  (server) => {
    for (const tool of MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        },
        async (input, extra) => {
          try {
            return text(await tool.handler(contextFromAuth(extra.http?.authInfo), input));
          } catch (error) {
            // Model facing errors go back as tool results so the model can retry.
            if (error instanceof ToolError) return { ...text({ error: error.message }), isError: true };
            // Anything else is ours: log it, never hand Prisma internals to the client.
            console.error(`MCP tool ${tool.name} failed:`, error);
            return { ...text({ error: "Internal error. Try the same call again in a moment." }), isError: true };
          }
        },
      );
    }
    for (const prompt of MCP_PROMPTS) {
      server.registerPrompt(
        prompt.name,
        { title: prompt.title, description: prompt.description, argsSchema: prompt.argsSchema },
        (args) => ({
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: prompt.render(args as Record<string, string | undefined>) },
            },
          ],
        }),
      );
    }
  },
  {
    serverInfo: { name: "your-map-event", version: "0.1.0" },
    instructions:
      "Builds Your Map Event maps: events, points of interest and schedule activities for the token's team. Start with get_team. The create_event_from_map_photo prompt walks through turning a map photo into points.",
  },
);

const authed = withMcpAuth(handler, (req, bearer) => verifyMcpToken(getPublicOrigin(req), bearer), {
  required: true,
});

// Served at /api/mcp/mcp; any other transport segment is not an endpoint.
async function route(req: Request, { params }: { params: Promise<{ transport: string }> }) {
  const { transport } = await params;
  if (transport !== "mcp") return new Response("Not found", { status: 404 });
  return authed(req);
}

export { route as GET, route as POST, route as DELETE };
