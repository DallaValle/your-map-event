import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { MapEditor } from "@/components/map-editor/MapEditor";

export const metadata: Metadata = { title: "Edit event" };

export default async function EventEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");

  const map = await prisma.event.findUnique({
    where: { id: eventId },
    include: { pois: { orderBy: { createdAt: "asc" } } },
  });
  // Admins can only edit their own team's maps.
  if (!map || map.teamId !== membership.team.id) notFound();

  return (
    <MapEditor
      map={map}
      pois={map.pois}
      teamSlug={membership.team.slug}
      teamName={membership.team.name}
      teamLogoUrl={membership.team.logoUrl}
      uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
    />
  );
}
