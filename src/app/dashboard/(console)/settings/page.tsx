import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      icon="⚙️"
      title="Settings"
      description="Your personal settings: profile, password, notification preferences and connected accounts."
    />
  );
}
