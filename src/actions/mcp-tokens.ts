"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { generateToken } from "@/lib/mcp/auth";
import type { ActionState } from "./types";

/** Success carries the raw token: the only moment it is ever visible. */
export type CreateTokenState = { ok: true; token: string; name: string } | { ok: false; error: string } | null;

const tokenNameSchema = z.string().trim().min(1, "Give the token a name").max(60);

export async function createMcpTokenAction(
  teamId: string,
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  let session;
  try {
    ({ session } = await requireAdmin(teamId));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  const name = tokenNameSchema.safeParse(formData.get("name"));
  if (!name.success) return { ok: false, error: name.error.issues[0].message };

  const { raw, tokenHash, prefix } = generateToken();
  await prisma.mcpToken.create({
    data: { teamId, name: name.data, tokenHash, prefix, createdByEmail: session.user.email },
  });

  revalidatePath("/dashboard/ai");
  return { ok: true, token: raw, name: name.data };
}

export async function revokeMcpTokenAction(tokenId: string): Promise<ActionState> {
  const token = await prisma.mcpToken.findUnique({ where: { id: tokenId } });
  if (!token) return { ok: false, error: "Token not found" };
  try {
    await requireAdmin(token.teamId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Forbidden" };
  }

  await prisma.mcpToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  revalidatePath("/dashboard/ai");
  return { ok: true };
}
