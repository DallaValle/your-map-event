import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <SectionPlaceholder
      icon="🕑"
      title="History"
      description="A post-event archive and analytics: attendance, most-visited points of interest, and every past edition of your events in one place."
    />
  );
}
