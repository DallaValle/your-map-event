import { getTranslations } from "next-intl/server";
import { pageTitle } from "@/i18n/metadata";
import { SectionPlaceholder } from "@/components/section/SectionPlaceholder";

export const generateMetadata = pageTitle("history");

export default async function HistoryPage() {
  const t = await getTranslations("placeholders");
  return (
    <SectionPlaceholder
      icon="🕑"
      title={t("history.title")}
      description={t("history.description")}
    />
  );
}
