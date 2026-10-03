"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Bell, CalendarClock, ChevronDown, Megaphone } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { buildFeed, type FeedItem, type LiveFeedDTO } from "@/lib/announcement-feed";
import { formatClock } from "@/lib/schedule-time";
import { AnnouncementBanner } from "./AnnouncementBanner";

const POLL_MS = 60_000;
const TICK_MS = 30_000;

type LiveAnnouncementsState = {
  items: FeedItem[];
  unread: FeedItem[];
  markSeen: () => void;
};

const LiveAnnouncementsContext = createContext<LiveAnnouncementsState | null>(null);

function useLiveAnnouncements() {
  const value = useContext(LiveAnnouncementsContext);
  if (!value) throw new Error("LiveAnnouncementsProvider is missing");
  return value;
}

function seenKey(eventId: string) {
  return `announcements-read:${eventId}`;
}

// Enough to cover every item an event can show at once; older ids are long gone from the feed.
const MAX_SEEN = 200;

// Ids, not times: manual items carry server time, "starting soon" ones device time.
// Storage can throw (private mode, blocked site data): reading falls back to "nothing seen".
function readSeen(eventId: string): Set<string> {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(seenKey(eventId)) ?? "[]");
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSeen(eventId: string, ids: Set<string>) {
  try {
    localStorage.setItem(seenKey(eventId), JSON.stringify([...ids].slice(-MAX_SEEN)));
  } catch {}
}

/**
 * Feeds the live map bell and banner: polls the event's announcements and
 * re-evaluates which schedule items are "starting soon" on the device clock.
 */
export function LiveAnnouncementsProvider({
  eventId,
  initial,
  children,
}: {
  eventId: string;
  initial: LiveFeedDTO;
  children: React.ReactNode;
}) {
  const [feed, setFeed] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSeen(readSeen(eventId));
    setNow(Date.now());

    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(`/api/live/${eventId}/announcements`, { cache: "no-store" });
        if (res.ok && !cancelled) setFeed(await res.json());
      } catch {
        // Offline on the event grounds: keep the last feed.
      }
      if (!cancelled) setNow(Date.now());
    }
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [eventId]);

  const items = useMemo(() => (now == null ? [] : buildFeed(feed, now)), [feed, now]);
  const unread = useMemo(() => items.filter((item) => !seen.has(item.id)), [items, seen]);

  const markSeen = useCallback(() => {
    if (unread.length === 0) return;
    const next = new Set(seen);
    for (const item of unread) next.add(item.id);
    setSeen(next);
    writeSeen(eventId, next);
  }, [unread, seen, eventId]);

  const value = useMemo(() => ({ items, unread, markSeen }), [items, unread, markSeen]);
  return <LiveAnnouncementsContext.Provider value={value}>{children}</LiveAnnouncementsContext.Provider>;
}

function useItemText() {
  const t = useTranslations("announcements.live");
  return (item: FeedItem) =>
    item.kind === "manual"
      ? { title: item.title, body: item.body }
      : {
          title: t("startingSoon", { name: item.activity.name }),
          body: item.activity.place
            ? t("startsAtPlace", { time: formatClock(item.activity.startTime), place: item.activity.place })
            : t("startsAt", { time: formatClock(item.activity.startTime) }),
        };
}

/** Newest unread item on top of the map until dismissed or read under the bell. */
export function LiveAnnouncementBanner() {
  const { unread, markSeen } = useLiveAnnouncements();
  const text = useItemText();
  const newest = unread[0];
  if (!newest) return null;
  const { title, body } = text(newest);
  return <AnnouncementBanner key={newest.id} title={title} body={body} onDismiss={markSeen} />;
}

/** Top bar bell: unread badge, opens every current announcement. */
export function LiveAnnouncementBell() {
  const t = useTranslations("announcements.live");
  const { items, unread, markSeen } = useLiveAnnouncements();
  const text = useItemText();
  const [open, setOpen] = useState(false);

  // Whatever lands while the sheet is open is read on the spot.
  useEffect(() => {
    if (open) markSeen();
  }, [open, markSeen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={unread.length > 0 ? t("bellUnread", { count: unread.length }) : t("bell")}
        title={t("bell")}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Icon icon={Bell} />
        {unread.length > 0 && (
          <span
            data-testid="announcement-badge"
            className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-fg"
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {/* Portaled: the top bar is its own stacking context, under the bottom bar. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[1100] flex flex-col justify-end">
          <button type="button" aria-label={t("close")} onClick={() => setOpen(false)} className="flex-1 bg-black/30" />
          <section
            aria-label={t("title")}
            className="max-h-[65dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-950"
          >
            <div className="sticky top-0 bg-white/95 px-5 pb-2 pt-3 backdrop-blur dark:bg-neutral-950/95">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{t("title")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                  className="flex size-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"
                >
                  <Icon icon={ChevronDown} />
                </button>
              </div>
            </div>
            {items.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm opacity-60">{t("empty")}</p>
            ) : (
              <ul className="divide-y divide-black/10 px-5 dark:divide-white/15">
                {items.map((item) => {
                  const { title, body } = text(item);
                  return (
                    <li key={item.id} className="flex gap-3 py-3">
                      <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"
                      >
                        <Icon icon={item.kind === "manual" ? Megaphone : CalendarClock} size="sm" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{title}</p>
                        <p className="mt-0.5 text-sm leading-snug opacity-70">{body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
