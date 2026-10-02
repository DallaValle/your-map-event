import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("offline"))("title") };
}

// Service-worker fallback for uncached navigations while offline.
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <Icon icon={WifiOff} size="xl" className="text-brand" />
      <h1 className="text-xl font-bold">{t("heading")}</h1>
      <p className="max-w-xs text-sm opacity-70">
        {t("body")}
      </p>
    </main>
  );
}
