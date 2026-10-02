import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { ChartColumn } from "lucide-react";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const generateMetadata = pageTitle("analytics");

export default async function AnalyticsPage() {
  const t = await getTranslations("placeholders");
  return (
    <SectionPlaceholder
      icon={ChartColumn}
      title={t("analytics.title")}
      description={t("analytics.description")}
    />
  );
}
