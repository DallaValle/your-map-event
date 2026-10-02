import { notFound, redirect } from "next/navigation";
import { pageTitle } from "@/i18n/metadata";
import { prisma } from "@/lib/prisma";
import { getMyTeam, isAdminRole } from "@/lib/session";
import { MapEditor } from "@/components/map-editor/MapEditor";

export const generateMetadata = pageTitle("editEvent");

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
    include: {
      pois: { orderBy: { createdAt: "asc" } },
      categories: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      activities: {
        include: { poi: { select: { title: true, icon: true } } },
        orderBy: { startTime: "asc" },
      },
    },
  });
  // Admins can only edit their own team's maps.
  if (!map || map.teamId !== membership.team.id) notFound();

  return (
    <MapEditor
      map={map}
      pois={map.pois}
      categories={map.categories.map(({ id, name, icon, color }) => ({ id, name, icon, color }))}
      activities={map.activities.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        startTime: row.startTime?.toISOString() ?? null,
        endTime: row.endTime?.toISOString() ?? null,
        poiId: row.poiId,
        poiTitle: row.poi?.title ?? null,
        poiIcon: row.poi?.icon ?? null,
      }))}
      teamSlug={membership.team.slug}
      teamName={membership.team.name}
      uploadsEnabled={!!process.env.UPLOADTHING_TOKEN}
    />
  );
}
