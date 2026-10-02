import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { History } from "lucide-react";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const generateMetadata = pageTitle("history");

export default async function HistoryPage() {
  const t = await getTranslations("placeholders");
  return (
    <SectionPlaceholder
      icon={History}
      title={t("history.title")}
      description={t("history.description")}
    />
  );
}
