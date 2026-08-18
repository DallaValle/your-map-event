"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { THEME_COOKIE, THEMES, type ThemePreference } from "@/components/settings/prefs";
import type { ActionState } from "./types";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(64),
  image: z.union([z.url(), z.literal("")]).nullish(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

const prefsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  eventAnnouncements: z.boolean(),
});

const themeSchema = z.object({
  theme: z.enum(THEMES),
});

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function setThemeCookie(theme: ThemePreference) {
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    image: formData.get("image"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await auth.api.updateUser({
      body: { name: parsed.data.name, image: parsed.data.image || null },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Could not update your profile.") };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Could not update your password.") };
  }

  return { ok: true };
}

export async function updateNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = prefsSchema.safeParse({
    emailNotifications: formData.get("emailNotifications") === "on",
    pushNotifications: formData.get("pushNotifications") === "on",
    eventAnnouncements: formData.get("eventAnnouncements") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function updateThemeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = themeSchema.safeParse({ theme: formData.get("theme") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, theme: parsed.data.theme },
    update: { theme: parsed.data.theme },
  });
  await setThemeCookie(parsed.data.theme);

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
