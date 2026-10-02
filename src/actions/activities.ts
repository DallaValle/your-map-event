"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { isActivityType } from "@/lib/activity";
import { MAX_ACTIVITY_DAYS, parseWallClock } from "@/lib/schedule-time";
import { fail } from "@/i18n/action-errors";
import type { ActionState } from "./types";

const MAX_SPAN_MS = MAX_ACTIVITY_DAYS * 24 * 60 * 60 * 1000;

function wallClockField(label: string, required: boolean) {
  return z.unknown().transform((value, ctx) => {
    if (value == null || value === "") {
      if (required) {
        ctx.addIssue({ code: "custom", message: `${label} is required` });
        return z.NEVER;
      }
      return null;
    }
    const date = parseWallClock(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: `${label} is invalid` });
      return z.NEVER;
    }
    return date;
  });
}

const activitySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    type: z
      .string()
      .transform((value, ctx) => {
        if (!isActivityType(value)) {
          ctx.addIssue({ code: "custom", message: "Pick an activity type" });
          return z.NEVER;
        }
        return value;
      }),
    startTime: wallClockField("Start time", false),
    endTime: wallClockField("End time", false),
    poiId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .superRefine((data, ctx) => {
    const hasStart = !!data.startTime;
    const hasEnd = !!data.endTime;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        message: "Set both start and end, or leave both empty to keep it unscheduled",
        path: ["endTime"],
      });
      return;
    }
    if (data.startTime && data.endTime) {
      if (data.endTime.getTime() <= data.startTime.getTime()) {
        ctx.addIssue({
          code: "custom",
          message: "End time must be after start time",
          path: ["endTime"],
        });
      } else if (data.endTime.getTime() - data.startTime.getTime() > MAX_SPAN_MS) {
        ctx.addIssue({
          code: "custom",
          message: `An activity cannot run longer than ${MAX_ACTIVITY_DAYS} days`,
          path: ["endTime"],
        });
      }
    }
  });

function parseActivityForm(formData: FormData) {
  return activitySchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "other",
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    poiId: formData.get("poiId") || undefined,
  });
}

async function revalidateSchedule(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: { select: { slug: true } } },
  });
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/board");
  revalidatePath("/dashboard");
  if (event) {
    revalidatePath(`/dashboard/events/${event.id}`);
    revalidatePath(`/${event.team.slug}`);
    revalidatePath(`/${event.team.slug}/${event.slug}`);
  }
}

async function requireEventAdmin(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");
  const { team } = await requireAdmin(event.teamId);
  return { event, team };
}

async function requireActivityAdmin(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { event: true },
  });
  if (!activity) throw new Error("Activity not found");
  const { team } = await requireAdmin(activity.event.teamId);
  return { activity, team };
}

async function assertPoiOnEvent(eventId: string, poiId: string | null) {
  if (!poiId) return;
  const poi = await prisma.pointOfInterest.findFirst({
    where: { id: poiId, mapId: eventId },
  });
  if (!poi) throw new Error("Location is not on this event");
}

export async function createActivityAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireEventAdmin(eventId);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }

  const parsed = parseActivityForm(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await assertPoiOnEvent(eventId, parsed.data.poiId);
    await prisma.activity.create({
      data: { eventId, ...parsed.data },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create activity");
  }

  await revalidateSchedule(eventId);
  return { ok: true };
}

export async function updateActivityAction(
  activityId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let eventId: string;
  try {
    const { activity } = await requireActivityAdmin(activityId);
    eventId = activity.eventId;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }

  const parsed = parseActivityForm(formData);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await assertPoiOnEvent(eventId, parsed.data.poiId);
    await prisma.activity.update({
      where: { id: activityId },
      data: parsed.data,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not update activity");
  }

  await revalidateSchedule(eventId);
  return { ok: true };
}

export async function deleteActivityAction(activityId: string): Promise<ActionState> {
  try {
    const { activity } = await requireActivityAdmin(activityId);
    await prisma.activity.delete({ where: { id: activityId } });
    await revalidateSchedule(activity.eventId);
    return { ok: true };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }
}

const placementSchema = z
  .object({
    poiId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
    startTime: wallClockField("Start time", true),
    endTime: wallClockField("End time", true),
  })
  .refine((data) => data.endTime! > data.startTime!, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

/** Drop onto the timeline: set location + window in one go. */
export async function placeActivityAction(
  activityId: string,
  payload: { poiId: string | null; startTime: string; endTime: string },
): Promise<ActionState> {
  let eventId: string;
  try {
    const { activity } = await requireActivityAdmin(activityId);
    eventId = activity.eventId;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }

  const parsed = placementSchema.safeParse(payload);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  try {
    await assertPoiOnEvent(eventId, parsed.data.poiId);
    await prisma.activity.update({
      where: { id: activityId },
      data: parsed.data,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not place activity");
  }

  await revalidateSchedule(eventId);
  return { ok: true };
}

export async function unscheduleActivityAction(activityId: string): Promise<ActionState> {
  try {
    const { activity } = await requireActivityAdmin(activityId);
    await prisma.activity.update({
      where: { id: activityId },
      data: { startTime: null, endTime: null, poiId: null },
    });
    await revalidateSchedule(activity.eventId);
    return { ok: true };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }
}

const windowSchema = z
  .object({
    startTime: wallClockField("Event start", true),
    endTime: wallClockField("Event end", true),
  })
  .refine((data) => data.endTime! > data.startTime!, {
    message: "Event end must be after start",
    path: ["endTime"],
  });

export async function updateEventWindowAction(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireEventAdmin(eventId);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Forbidden");
  }

  const parsed = windowSchema.safeParse({
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  await prisma.event.update({
    where: { id: eventId },
    data: parsed.data,
  });
  await revalidateSchedule(eventId);
  return { ok: true };
}
