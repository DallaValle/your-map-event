"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  isPostChannel,
  isPostStatus,
  parseWallClock,
  type PostStatus,
} from "@/lib/social";
import { fail } from "@/i18n/action-errors";
import type { ActionState } from "./types";

const createSchema = z.object({
  body: z.string().trim().min(1, "Write a post first").max(500),
  channel: z.string(),
  status: z.string(),
  scheduledAt: z.string().optional(),
});

async function loadEventForAdmin(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: true },
  });
  if (!event) throw new Error("Event not found");
  await requireAdmin(event.teamId);
  return event;
}

async function loadPostForAdmin(postId: string) {
  const post = await prisma.scheduledPost.findUnique({
    where: { id: postId },
    include: { campaign: { include: { event: { include: { team: true } } } } },
  });
  if (!post) throw new Error("Post not found");
  await requireAdmin(post.campaign.event.teamId);
  return post;
}

async function ensureCampaign(eventId: string, eventName: string) {
  return prisma.socialCampaign.upsert({
    where: { eventId },
    update: {},
    create: { eventId, name: `${eventName} campaign` },
  });
}

function parseScheduledAt(
  value: string | undefined,
  required: boolean,
): { error: string } | { date: Date | null } {
  if (!value) {
    if (required) return { error: "Pick a date and time to schedule." };
    return { date: null };
  }
  const date = parseWallClock(value);
  if (!date) {
    return { error: "That date and time is not valid." };
  }
  return { date };
}

function revalidateSocial() {
  revalidatePath("/dashboard/social");
}

export async function createScheduledPostAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const event = await loadEventForAdmin(eventId);

  const parsed = createSchema.safeParse({
    body: formData.get("body"),
    channel: formData.get("channel") ?? "x",
    status: formData.get("status") ?? "draft",
    scheduledAt: String(formData.get("scheduledAt") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0].message);
  }

  const { body, channel, status, scheduledAt } = parsed.data;
  if (!isPostChannel(channel)) {
    return fail("Pick a channel.");
  }
  if (!isPostStatus(status) || status === "done") {
    return fail("Save as a draft or schedule the post.");
  }

  const when = parseScheduledAt(scheduledAt, status === "scheduled");
  if ("error" in when) return fail(when.error);

  const campaign = await ensureCampaign(event.id, event.name);
  await prisma.scheduledPost.create({
    data: {
      campaignId: campaign.id,
      body,
      channel,
      status,
      scheduledAt: when.date,
    },
  });

  revalidateSocial();
  return { ok: true };
}

export async function setScheduledPostStatusAction(
  postId: string,
  status: PostStatus,
  scheduledAt?: string,
): Promise<ActionState> {
  const post = await loadPostForAdmin(postId);
  if (!isPostStatus(status)) {
    return fail("Unknown post status.");
  }

  let nextScheduledAt = post.scheduledAt;
  if (status === "scheduled") {
    const when = parseScheduledAt(scheduledAt, !post.scheduledAt);
    if ("error" in when) return fail(when.error);
    if (when.date) nextScheduledAt = when.date;
  }

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: { status, scheduledAt: nextScheduledAt },
  });

  revalidateSocial();
  return { ok: true };
}

export async function deleteScheduledPostAction(postId: string): Promise<ActionState> {
  const post = await loadPostForAdmin(postId);
  await prisma.scheduledPost.delete({ where: { id: post.id } });
  revalidateSocial();
  return { ok: true };
}
