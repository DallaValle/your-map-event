import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { NewMapForm } from "@/components/map-editor/NewMapForm";

export const metadata: Metadata = { title: "New map" };

export default async function NewMapPage() {
  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");

  return (
    <main className="flex flex-col gap-6 px-5 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">New event map</h1>
        <p className="text-sm opacity-70">
          Set the basics now — you’ll add points of interest next.
        </p>
      </div>
      <NewMapForm teamId={membership.team.id} />
    </main>
  );
}
