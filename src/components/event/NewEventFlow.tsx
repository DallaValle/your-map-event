"use client";

import { useActionState, useState } from "react";
import { createMapAction } from "@/actions/maps";
import { PendingLabel } from "@/components/ui/Spinner";

/** Placeholder price until Stripe (or similar) is wired up. */
const EVENT_PRICE_LABEL = "$29";
const EVENT_PRICE_NOTE = "one-time per event · mock checkout";

type Step = "pay" | "name";

/**
 * New-event funnel: mock payment → name only → dashboard.
 * Real billing later replaces the pay step; the name form and create action stay.
 */
export function NewEventFlow({ teamId }: { teamId: string }) {
  const [step, setStep] = useState<Step>("pay");
  const [paying, setPaying] = useState(false);
  const [state, formAction, pending] = useActionState(
    createMapAction.bind(null, teamId),
    null,
  );

  async function handleMockPay() {
    setPaying(true);
    // Brief pause so the button feels like a checkout, not a no-op click.
    await new Promise((r) => setTimeout(r, 700));
    setPaying(false);
    setStep("name");
  }

  if (step === "pay") {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
            Per event
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">{EVENT_PRICE_LABEL}</span>
            <span className="text-sm opacity-60">{EVENT_PRICE_NOTE}</span>
          </p>
          <ul className="mt-5 space-y-2.5 text-sm">
            {[
              "Interactive event map with custom POIs",
              "Public share link for attendees",
              "Team access and live publish controls",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-brand" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Demo only — no card is charged. A real payment provider will replace this step.
        </p>

        <button
          type="button"
          onClick={handleMockPay}
          disabled={paying}
          aria-busy={paying}
          className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
        >
          <PendingLabel
            pending={paying}
            label={`Pay ${EVENT_PRICE_LABEL} and continue`}
            pendingLabel="Processing…"
          />
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="paymentConfirmed" value="1" />

      <div className="flex items-center gap-2 text-xs font-medium text-brand">
        <span
          className="flex size-5 items-center justify-center rounded-full bg-brand-soft text-[10px]"
          aria-hidden
        >
          ✓
        </span>
        Payment confirmed
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Event name
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoFocus
          placeholder="Summer Festival 2026"
          className="rounded-xl border border-black/15 px-4 py-3 text-base outline-brand dark:border-white/20 dark:bg-white/5"
        />
      </label>

      <p className="text-sm opacity-60">
        You can set the venue, map framing, and points of interest on the
        dashboard after this.
      </p>

      {state && !state.ok && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl bg-brand px-6 py-3.5 font-semibold text-brand-fg disabled:opacity-60 active:scale-[.98]"
      >
        <PendingLabel pending={pending} label="Create event" pendingLabel="Creating…" />
      </button>
    </form>
  );
}
