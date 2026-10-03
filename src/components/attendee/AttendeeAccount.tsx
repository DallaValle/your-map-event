"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { LogOut, UserRound, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { PendingLabel } from "@/components/ui/Spinner";
import { signInAttendeeAction, signOutAttendeeAction, signUpAttendeeAction } from "@/actions/attendee";
import { AUTH_ERROR_PARAM } from "@/lib/attendee/oauth-cookie";

export type AttendeeView = { name: string; email: string | null; image: string | null };
type Provider = "google" | "facebook";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function Avatar({ attendee }: { attendee: AttendeeView }) {
  return attendee.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={attendee.image} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-fg">
      {initials(attendee.name)}
    </span>
  );
}

/**
 * Attendee account in the live map top bar: an avatar that opens sign in
 * (Google, Facebook, email) when signed out, or a sign out menu when signed in.
 * The account belongs to this event only.
 */
export function AttendeeAccount({
  eventId,
  eventName,
  attendee,
  providers,
}: {
  eventId: string;
  eventName: string;
  attendee: AttendeeView | null;
  providers: Provider[];
}) {
  const t = useTranslations("attendee");
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Tied to the panel kind: when a sign in or out lands, the stale panel hides on its own.
  const [panel, setPanel] = useState<"menu" | "sheet" | null>(null);
  const open = panel === (attendee ? "menu" : "sheet");
  const [providerError, setProviderError] = useState(false);

  // A failed Google or Facebook round trip comes back with a flag: show it once, then drop it from the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(AUTH_ERROR_PARAM)) return;
    url.searchParams.delete(AUTH_ERROR_PARAM);
    window.history.replaceState(null, "", url);
    setProviderError(true);
    setPanel("sheet");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setPanel(null);
    setProviderError(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setPanel(open ? null : attendee ? "menu" : "sheet")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={attendee ? t("account", { name: attendee.name }) : t("signIn")}
        data-testid="attendee-avatar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10 active:scale-95 dark:ring-white/15"
      >
        {attendee ? (
          <Avatar attendee={attendee} />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
            <Icon icon={UserRound} size="sm" />
          </span>
        )}
      </button>
      {open &&
        createPortal(
          attendee ? (
            <AccountMenu eventId={eventId} attendee={attendee} anchor={buttonRef.current} onClose={close} />
          ) : (
            <SignInSheet
              eventId={eventId}
              eventName={eventName}
              providers={providers}
              providerError={providerError}
              onClose={close}
            />
          ),
          document.body,
        )}
    </>
  );
}

function AccountMenu({
  eventId,
  attendee,
  anchor,
  onClose,
}: {
  eventId: string;
  attendee: AttendeeView;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useTranslations("attendee");
  const [pending, startTransition] = useTransition();
  const rect = anchor?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[1200]">
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-label={t("accountMenu")}
        className="absolute w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10"
        style={{ top: (rect?.bottom ?? 56) + 8, left: rect?.left ?? 16 }}
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar attendee={attendee} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{attendee.name}</p>
            {attendee.email && <p className="truncate text-xs opacity-60">{attendee.email}</p>}
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await signOutAttendeeAction(eventId);
              onClose();
            })
          }
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/10"
        >
          <Icon icon={LogOut} size="sm" />
          <PendingLabel pending={pending} label={t("signOut")} />
        </button>
      </div>
    </div>
  );
}

const input =
  "rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5";
const providerButton =
  "flex items-center justify-center gap-3 rounded-xl px-6 py-3 font-semibold active:scale-[.98]";

function SignInSheet({
  eventId,
  eventName,
  providers,
  providerError,
  onClose,
}: {
  eventId: string;
  eventName: string;
  providers: Provider[];
  providerError: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("attendee");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [signInState, signIn, signingIn] = useActionState(signInAttendeeAction, null);
  const [signUpState, signUp, signingUp] = useActionState(signUpAttendeeAction, null);
  const state = mode === "sign-in" ? signInState : signUpState;
  const pending = signingIn || signingUp;
  const error = state && !state.ok ? state.error : providerError ? t("providerFailed") : null;

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col justify-end sm:items-center sm:justify-center">
      <button type="button" aria-label={t("close")} onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendee-sign-in-title"
        className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:max-w-sm sm:rounded-3xl sm:pb-5 dark:bg-neutral-950"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/20 sm:hidden dark:bg-white/25" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="attendee-sign-in-title" className="text-lg font-bold">
              {mode === "sign-in" ? t("signInTitle") : t("signUpTitle")}
            </h2>
            <p className="text-sm opacity-60">{t("scope", { event: eventName })}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        {providers.length > 0 && (
          <>
            <div className="mt-4 flex flex-col gap-2">
              {providers.includes("google") && (
                <a
                  href={`/api/attendee-auth/google?event=${encodeURIComponent(eventId)}`}
                  className={`${providerButton} border border-black/15 bg-white text-neutral-900 dark:border-white/20`}
                >
                  <GoogleMark />
                  {t("continueWithGoogle")}
                </a>
              )}
              {providers.includes("facebook") && (
                <a
                  href={`/api/attendee-auth/facebook?event=${encodeURIComponent(eventId)}`}
                  className={`${providerButton} bg-[#1877F2] text-white`}
                >
                  <FacebookMark />
                  {t("continueWithFacebook")}
                </a>
              )}
            </div>
            <div className="my-4 flex items-center gap-3 text-xs uppercase opacity-40">
              <span className="h-px flex-1 bg-current" />
              {t("or")}
              <span className="h-px flex-1 bg-current" />
            </div>
          </>
        )}

        {/* Keyed by mode so each flow keeps its own autocomplete hints and clears stale input. */}
        <form
          key={mode}
          action={mode === "sign-in" ? signIn : signUp}
          className={`flex flex-col gap-3 ${providers.length ? "" : "mt-4"}`}
        >
          <input type="hidden" name="eventId" value={eventId} />
          {mode === "sign-up" && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("name")}
              <input name="name" required maxLength={64} autoComplete="name" className={input} />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("email")}
            <input name="email" type="email" required autoComplete="username" inputMode="email" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("password")}
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              className={input}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="mt-1 rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg active:scale-[.98] disabled:opacity-60"
          >
            <PendingLabel
              pending={pending}
              label={mode === "sign-in" ? t("signIn") : t("createAccount")}
              pendingLabel={t("pleaseWait")}
            />
          </button>
        </form>

        <p className="mt-4 text-center text-sm opacity-70">
          {mode === "sign-in" ? t("newHere") : t("haveAccount")}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="font-semibold text-brand"
          >
            {mode === "sign-in" ? t("createAnAccount") : t("signIn")}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07"
      />
    </svg>
  );
}
