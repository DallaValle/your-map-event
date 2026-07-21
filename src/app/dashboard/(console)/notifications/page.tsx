import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <SectionPlaceholder
      icon="🔔"
      title="Notifications"
      description="Broadcast live announcements to attendees during the event: schedule changes, weather alerts, or a quick 'gates closing in 10 minutes'."
    />
  );
}
