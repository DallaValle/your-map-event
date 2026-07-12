"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/session";
import { slugify, validateSlug } from "@/lib/slug";
import type { ActionState } from "./types";

const teamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters").max(64),
  slug: z.string().trim().toLowerCase(),
});

export async function createTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = teamSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || slugify(String(formData.get("name") ?? "")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { name, slug } = parsed.data;

  const slugError = validateSlug(slug);
  if (slugError) return { ok: false, error: slugError };

  if (await prisma.team.findUnique({ where: { slug } })) {
    return { ok: false, error: `The address "/${slug}" is already taken.` };
  }

  let orgId: string;
  try {
    // Passing request headers ties the new org to the caller's session, so
    // Better Auth also marks it as the active organization.
    const org = await auth.api.createOrganization({
      body: { name, slug, userId: session.user.id },
      headers: await headers(),
    });
    if (!org) throw new Error("Organization creation returned no result");
    orgId = org.id;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create the team.",
    };
  }

  await prisma.team.create({ data: { orgId, slug, name } });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

const teamProfileSchema = teamSchema.extend({
  logoUrl: z.union([z.url(), z.literal("")]).nullish(),
});

export async function updateTeamAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { team } = await requireAdmin(teamId);

  const parsed = teamProfileSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    logoUrl: formData.get("logoUrl"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { name, slug, logoUrl } = parsed.data;

  if (slug !== team.slug) {
    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };
    if (await prisma.team.findUnique({ where: { slug } })) {
      return { ok: false, error: `The address "/${slug}" is already taken.` };
    }
  }

  await prisma.team.update({
    where: { id: team.id },
    data: { name, slug, logoUrl: logoUrl || null },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/${team.slug}`);
  revalidatePath(`/${slug}`);
  return { ok: true };
}
