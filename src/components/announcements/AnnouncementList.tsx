"use client";

import { useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { deleteAnnouncementAction } from "@/actions/announcements";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  authorName: string;
  /** Real instant, ISO. */
  publishAt: string;
};

const noop = () => () => {};

/** Times render in this device's timezone, which the server cannot know: client only. */
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function useWhen(scheduled: boolean) {
  const t = useTranslations("announcements");
  const locale = useLocale();
  const mounted = useMounted();
  return (iso: string) => {
    if (!mounted) return "";
    const date = new Date(iso);
    const delta = Date.now() - date.getTime();
    if (!scheduled) {
      if (delta < 60_000) return t("sentAt.now");
      if (delta < 3_600_000) return t("sentAt.minutes", { count: Math.floor(delta / 60_000) });
      if (delta < 86_400_000) return t("sentAt.hours", { count: Math.floor(delta / 3_600_000) });
    }
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };
}

export function AnnouncementList({
  items,
  scheduled = false,
  canDelete,
}: {
  items: AnnouncementRow[];
  scheduled?: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("announcements");
  const when = useWhen(scheduled);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/20 px-4 py-8 text-center text-sm opacity-60 dark:border-white/25">
        {t(scheduled ? "emptyScheduled" : "empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="min-w-0 truncate font-medium">{item.title}</h3>
              <time dateTime={item.publishAt} className="shrink-0 text-xs opacity-60">
                {scheduled ? t("goesOut", { when: when(item.publishAt) }) : when(item.publishAt)}
              </time>
            </div>
            <p className="text-sm opacity-80">{item.body}</p>
            <p className="text-xs opacity-50">{t(scheduled ? "scheduledBy" : "sentBy", { name: item.authorName })}</p>
          </div>
          {canDelete && <DeleteButton id={item.id} label={t(scheduled ? "cancel" : "delete", { title: item.title })} />}
        </li>
      ))}
    </ul>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteAnnouncementAction(id);
          router.refresh();
        })
      }
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-60 dark:hover:bg-red-950 dark:hover:text-red-300"
    >
      {pending ? <Spinner /> : <Icon icon={Trash2} size="sm" />}
    </button>
  );
}
