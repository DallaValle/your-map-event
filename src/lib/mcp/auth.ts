import { createHash, randomBytes } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/prisma";

export const TOKEN_PREFIX = "yme_";
const DISPLAY_PREFIX_LENGTH = 12;
// Skip the lastUsedAt write when it is this fresh: tool calls come in bursts.
const LAST_USED_RESOLUTION_MS = 60_000;

export interface McpContext {
  teamId: string;
  tokenId: string;
  /** Public origin of the app, for links returned to the model. */
  origin: string;
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** A fresh raw token plus what gets stored. The raw value is never persisted. */
export function generateToken() {
  const raw = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { raw, tokenHash: hashToken(raw), prefix: raw.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Bearer check for withMcpAuth: undefined means 401. */
export async function verifyMcpToken(origin: string, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer?.startsWith(TOKEN_PREFIX)) return undefined;
  const token = await prisma.mcpToken.findUnique({ where: { tokenHash: hashToken(bearer) } });
  if (!token || token.revokedAt) return undefined;

  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.mcpToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
  }

  const context: McpContext = { teamId: token.teamId, tokenId: token.id, origin };
  return { token: bearer, clientId: token.id, scopes: [], extra: { ...context } };
}

export function contextFromAuth(authInfo: AuthInfo | undefined): McpContext {
  const extra = authInfo?.extra as Partial<McpContext> | undefined;
  if (!extra?.teamId || !extra.tokenId || !extra.origin) {
    throw new Error("Missing MCP authentication context");
  }
  return { teamId: extra.teamId, tokenId: extra.tokenId, origin: extra.origin };
}
