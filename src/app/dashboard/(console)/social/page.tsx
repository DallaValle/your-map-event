import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Social campaign" };

export default function SocialPage() {
  return (
    <SectionPlaceholder
      icon="📣"
      title="Social campaign"
      description="Plan and schedule the event's social posts, and generate share assets (QR codes and cards) straight from the published map."
    />
  );
}
