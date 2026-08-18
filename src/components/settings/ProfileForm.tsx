"use client";

import { useActionState, useState } from "react";
import { updateProfileAction } from "@/actions/settings";

const inputClass =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-teal-700 dark:border-white/20 dark:bg-white/5";

export function ProfileForm({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, null);
  const [avatarUrl, setAvatarUrl] = useState(image ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="size-16 rounded-full border border-black/10 object-cover dark:border-white/15"
          />
        ) : (
          <span
            className="flex size-16 items-center justify-center rounded-full bg-teal-700 text-lg font-semibold text-white"
            aria-hidden
          >
            {(name.trim() || email).slice(0, 2).toUpperCase()}
          </span>
        )}
        <p className="min-w-0 text-sm opacity-60">
          Shown in the account menu. Paste an image URL if you have one.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Name
        <input
          name="name"
          required
          minLength={2}
          maxLength={64}
          defaultValue={name}
          autoComplete="name"
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            readOnly
            className={`${inputClass} opacity-70`}
          />
        </label>
        <span className="text-xs opacity-60">Email is used to sign in and cannot be changed here.</span>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Avatar URL
        <input
          name="image"
          type="url"
          inputMode="url"
          placeholder="https://… (image URL)"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className={inputClass}
        />
      </label>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-teal-700/10 px-3 py-2 text-sm text-teal-700 dark:text-teal-400">
          Profile saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white disabled:opacity-60 active:scale-[.98]"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
