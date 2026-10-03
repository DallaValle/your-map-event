import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLiveFeed } from "@/lib/announcements";

export const dynamic = "force-dynamic";

/** Polled by the live map so announcements land without a reload. Published events only. */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { published: true } });
  if (!event?.published) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await getLiveFeed(eventId), {
    headers: { "Cache-Control": "no-store" },
  });
}
