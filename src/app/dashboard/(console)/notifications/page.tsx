import { redirect } from "next/navigation";

// Old bookmarks: the organizer side is called Announcements now.
export default function NotificationsPage() {
  redirect("/dashboard/announcements");
}
