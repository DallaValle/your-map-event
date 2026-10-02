import { useTranslations } from "next-intl";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
};

export function ConnectedAccounts({
  accounts,
}: {
  accounts: { id: string; providerId: string }[];
}) {
  const t = useTranslations("settings.accounts");
  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-black/10 px-4 py-3 text-sm opacity-70 dark:border-white/15">
        {t("none")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
      {accounts.map((account) => (
        <li key={account.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="font-medium">{account.providerId === "credential" ? t("credential") : (PROVIDER_LABELS[account.providerId] ?? account.providerId)}</p>
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
            {t("connected")}
          </span>
        </li>
      ))}
    </ul>
  );
}
