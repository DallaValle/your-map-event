"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markAnnouncementsSeenAction } from "@/actions/notifications";

/** Visiting the list marks the current announcements read for this browser. */
export function MarkAnnouncementsSeen({ eventId }: { eventId: string }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void markAnnouncementsSeenAction(eventId).then(() => router.refresh());
  }, [eventId, router]);

  return null;
}
