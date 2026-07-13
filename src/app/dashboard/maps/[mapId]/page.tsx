import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { MapEditor } from "@/components/map-editor/MapEditor";

export const metadata: Metadata = { title: "Edit map" };

export default async function MapEditorPage({
  params,
}: {
  params: Promise<{ mapId: string }>;
}) {
  const { mapId } = await params;

  const membership = await getMyTeam();
  if (!membership || !isAdminRole(membership.role)) redirect("/dashboard");

  const map = await prisma.eventMap.findUnique({
    where: { id: mapId },
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
      uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
    />
  );
}
