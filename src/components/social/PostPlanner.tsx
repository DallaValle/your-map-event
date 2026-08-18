"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteScheduledPostAction,
  setScheduledPostStatusAction,
} from "@/actions/social";
import { PostComposer } from "@/components/social/PostComposer";
import { channelLabel, type PostStatus } from "@/lib/social";

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
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState("");

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string } | null>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-black/10 px-4 py-3 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium opacity-60">
        <span>{channelLabel(post.channel)}</span>
        {post.scheduledAt && (
          <time dateTime={asDate(post.scheduledAt).toISOString()}>
            {formatWhen(asDate(post.scheduledAt))}
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
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs outline-teal-700 dark:border-white/20 dark:bg-white/5"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setScheduledPostStatusAction(post.id, "scheduled", when || undefined))
                }
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                Schedule
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setScheduledPostStatusAction(post.id, "done"))}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                Mark done
              </button>
            </>
          )}
          {post.status === "scheduled" && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setScheduledPostStatusAction(post.id, "done"))}
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Mark done
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setScheduledPostStatusAction(post.id, "draft"))}
                className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
              >
                Back to draft
              </button>
            </>
          )}
          {post.status === "done" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setScheduledPostStatusAction(post.id, "draft"))}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 dark:border-white/20"
            >
              Back to draft
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteScheduledPostAction(post.id))}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60 dark:text-red-400"
          >
            Delete
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

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
