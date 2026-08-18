import Link from "next/link";
import { buildScheduleDays, formatClock } from "@/lib/program-time";
import type { SessionDTO } from "@/lib/program-types";

export function ScheduleView({
  eventName,
  sessions,
}: {
  eventName: string;
  sessions: SessionDTO[];
}) {
  const days = buildScheduleDays(sessions);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-sm opacity-70">
          Hour by hour for {eventName}. The same sessions the team edits on the
          Board.
        </p>
      </header>

      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 px-5 py-10 text-center text-sm opacity-60 dark:border-white/15">
          No sessions yet.{" "}
          <Link href="/dashboard/board" className="font-medium text-teal-700 dark:text-teal-400">
            Add them on the Board
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {days.map((day) => (
            <section key={day.key} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
                {day.heading}
              </h2>
              <ol className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
                {day.hours.map((hour) => (
                  <li
                    key={hour.key}
                    aria-label={hour.label}
                    className="grid grid-cols-[4.5rem_1fr] border-t border-black/10 first:border-t-0 dark:border-white/15"
                  >
                    <div className="border-r border-black/10 px-3 py-3 text-sm font-semibold tabular-nums opacity-70 dark:border-white/15">
                      {hour.label}
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3">
                      {hour.sessions.length === 0 ? (
                        <p className="text-sm opacity-30">-</p>
                      ) : (
                        hour.sessions.map((session) => (
                          <article key={session.id} className="min-w-0">
                            <h3 className="font-semibold">{session.title}</h3>
                            <p className="text-sm opacity-60">
                              {formatClock(session.startsAt)} - {formatClock(session.endsAt)}
                              {session.location ? ` · ${session.location}` : ""}
                            </p>
                          </article>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
