import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { NewMapForm } from "@/components/map-editor/NewMapForm";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8">
      <Link
        href="/dashboard"
        className="inline-flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100"
      >
        <span aria-hidden>←</span> Back to events
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">New event</h1>
        <p className="text-sm opacity-70">
          Set the basics now, then build the map and add points of interest
          next.
        </p>
      </div>
      <NewMapForm teamId={membership.team.id} />
    </main>
  );
}
