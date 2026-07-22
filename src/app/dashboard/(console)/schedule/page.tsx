import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return (
    <SectionPlaceholder
      icon="🗓️"
      title="Schedule"
      description="The event timeline lives here: sessions, set times and the running order laid out hour by hour. Coming soon."
    />
  );
}
