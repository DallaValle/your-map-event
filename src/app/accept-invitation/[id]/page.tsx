import type { Metadata } from "next";
import { AcceptInvitation } from "@/components/team/AcceptInvitation";

export const metadata: Metadata = { title: "Team invitation" };

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AcceptInvitation invitationId={id} />;
}
