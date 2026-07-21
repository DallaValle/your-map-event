import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <SectionPlaceholder
      icon="📋"
      title="Board"
      description="A shared program board for your team: line-ups, session times and the running order, edited together and ready to publish to the event map."
    />
  );
}
