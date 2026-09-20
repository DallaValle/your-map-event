"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteScheduledPostAction,
  setScheduledPostStatusAction,
} from "@/actions/social";
import { PostComposer } from "@/components/social/PostComposer";
import { channelLabel, formatWallClock, type PostStatus } from "@/lib/social";
import { PendingLabel } from "@/components/ui/Spinner";

type PlannerPost = {
  id: string;
  body: string;
  channel: string;
  status: string;
  // RSC serializes Date as a string when it crosses to the client.
  scheduledAt: Date | string | null;
};

const COLUMNS: { status: PostStatus; title: string }[] = [
  { status: "draft", title: "Draft" },
  { status: "scheduled", title: "Scheduled" },
  { status: "done", title: "Done" },
];

export function PostPlanner({
  eventId,
  posts,
  isAdmin,
}: {
  eventId: string;
  posts: PlannerPost[];
  isAdmin: boolean;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          Post planner
        </h2>
        <p className="mt-0.5 text-sm opacity-60">
          Draft, schedule, then mark done when you have posted. Nothing is sent
          to X or Instagram from here.
        </p>
      </div>

      {isAdmin && <PostComposer eventId={eventId} />}

      <div className="flex flex-col gap-5">
        {COLUMNS.map((column) => {
          const items = posts.filter((post) => post.status === column.status);
          return (
            <div
              key={column.status}
              data-status={column.status}
              className="flex flex-col gap-2"
            >
              <h3 className="text-sm font-semibold">
                {column.title}
                <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium opacity-60 dark:bg-white/10">
                  {items.length}
                </span>
              </h3>
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm opacity-50 dark:border-white/15">
                  No {column.title.toLowerCase()} posts.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} isAdmin={isAdmin} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PostCard({ post, isAdmin }: { post: PlannerPost; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState("");

  useEffect(() => {
    if (!pending) setBusy(null);
  }, [pending]);

  function run(
    key: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string } | null>,
  ) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const spinner = "size-3";
  const isBusy = (key: string) => pending && busy === key;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-black/10 px-4 py-3 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium opacity-60">
        <span>{channelLabel(post.channel)}</span>
        {post.scheduledAt && (
          <time dateTime={asDate(post.scheduledAt).toISOString()}>
            {formatWallClock(asDate(post.scheduledAt))}
          </time>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {post.status === "draft" && (
            <>
              <input
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
                aria-label="Schedule time"
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs outline-brand dark:border-white/20 dark:bg-white/5"
              />
              <button
                type="button"
                disabled={pending}
                aria-busy={isBusy("schedule")}
                onClick={() =>
                  run("schedule", () =>
                    setScheduledPostStatusAction(post.id, "scheduled", when || undefined),
                  )
                }
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                <PendingLabel
                  pending={isBusy("schedule")}
                  label="Schedule"
                  pendingLabel="Saving…"
                  spinnerClassName={spinner}
                />
              </button>
              <button
                type="button"
                disabled={pending}
                aria-busy={isBusy("done")}
                onClick={() => run("done", () => setScheduledPostStatusAction(post.id, "done"))}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                <PendingLabel
                  pending={isBusy("done")}
                  label="Mark done"
                  pendingLabel="Saving…"
                  spinnerClassName={spinner}
                />
              </button>
            </>
          )}
          {post.status === "scheduled" && (
            <>
              <button
                type="button"
                disabled={pending}
                aria-busy={isBusy("done")}
                onClick={() => run("done", () => setScheduledPostStatusAction(post.id, "done"))}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg disabled:opacity-60"
              >
                <PendingLabel
                  pending={isBusy("done")}
                  label="Mark done"
                  pendingLabel="Saving…"
                  spinnerClassName={spinner}
                />
              </button>
              <button
                type="button"
                disabled={pending}
                aria-busy={isBusy("draft")}
                onClick={() => run("draft", () => setScheduledPostStatusAction(post.id, "draft"))}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                <PendingLabel
                  pending={isBusy("draft")}
                  label="Back to draft"
                  pendingLabel="Saving…"
                  spinnerClassName={spinner}
                />
              </button>
            </>
          )}
          {post.status === "done" && (
            <button
              type="button"
              disabled={pending}
              aria-busy={isBusy("draft")}
              onClick={() => run("draft", () => setScheduledPostStatusAction(post.id, "draft"))}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
            >
              <PendingLabel
                pending={isBusy("draft")}
                label="Back to draft"
                pendingLabel="Saving…"
                spinnerClassName={spinner}
              />
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            aria-busy={isBusy("delete")}
            onClick={() => run("delete", () => deleteScheduledPostAction(post.id))}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60 dark:text-red-400"
          >
            <PendingLabel
              pending={isBusy("delete")}
              label="Delete"
              pendingLabel="Deleting…"
              spinnerClassName={spinner}
            />
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}
