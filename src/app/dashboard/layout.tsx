import { requireSession, getMyTeam, isAdminRole } from "@/lib/session";
import { BottomNav } from "@/components/nav/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware only checks cookie presence; this is the real session check.
  await requireSession();
  const membership = await getMyTeam();

  return (
    <div className="min-h-dvh w-full pb-24">
      {children}
      <BottomNav
        teamSlug={membership?.team.slug}
        isAdmin={isAdminRole(membership?.role)}
      />
    </div>
  );
}
