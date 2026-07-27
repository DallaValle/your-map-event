import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { NewEventFlow } from "@/components/event/NewEventFlow";

export const metadata: Metadata = { title: "Pricing" };

export default async function NewEventPage() {
  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");

  return (
    <div className="flex min-h-full justify-center px-6 py-10">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
            Pricing
          </p>
          <h1 className="text-2xl font-bold tracking-tight">New event</h1>
          <p className="text-sm leading-relaxed opacity-70">
            Pay for the event, give it a name, then build the map from your
            dashboard.
          </p>
        </div>
        <NewEventFlow teamId={membership.team.id} />
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100"
        >
          <span aria-hidden>←</span> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
