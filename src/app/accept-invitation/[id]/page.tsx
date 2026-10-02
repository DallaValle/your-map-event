import { pageTitle } from "@/i18n/metadata";
import { AcceptInvitation } from "@/components/team/AcceptInvitation";

export const generateMetadata = pageTitle("invitation");

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AcceptInvitation invitationId={id} />;
}
