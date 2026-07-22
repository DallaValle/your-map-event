import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <SectionPlaceholder
      icon="📊"
      title="Analytics"
      description="Attendance, map engagement and social reach for your event, tracked over time. Coming soon."
    />
  );
}
