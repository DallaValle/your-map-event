import { requireSession } from "@/lib/session";

/**
 * Auth gate for the whole dashboard. Visual chrome (header, section nav,
 * footer) lives in the `(console)` group layout, so the full-screen event
 * editor under `/dashboard/events/[eventId]` can stay immersive.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only checks cookie presence; this is the real session check.
  await requireSession();
  return <>{children}</>;
}
