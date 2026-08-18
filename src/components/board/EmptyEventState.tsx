import Link from "next/link";

/** Shared empty body when Board or Schedule has no selected event. */
export function EmptyEventState({
  isAdmin,
  section,
}: {
  isAdmin: boolean;
  section: "Board" | "Schedule";
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-black/10 bg-white px-8 py-10 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
        <span
          className="flex size-16 items-center justify-center rounded-2xl bg-teal-700/10 text-3xl"
          aria-hidden
        >
          {section === "Board" ? "📋" : "🗓️"}
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">No event yet</h1>
          <p className="text-balance text-sm leading-relaxed opacity-70">
            {isAdmin
              ? `Create an event first, then come back to build the ${section.toLowerCase()}.`
              : "No published events yet. Check back soon!"}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/events/new"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white active:scale-[.98]"
          >
            + New event
          </Link>
        )}
      </div>
    </div>
  );
}
