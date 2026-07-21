/**
 * Consistent "coming soon" body for the dashboard sections that aren't built
 * yet. Shows the section's icon, name and a one-line description of what will
 * live there, so the product's shape is visible before the feature exists.
 */
export function SectionPlaceholder({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-teal-700/10 text-3xl" aria-hidden>
        {icon}
      </span>
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium opacity-60 dark:bg-white/10">
            Coming soon
          </span>
        </div>
        <p className="mx-auto max-w-md text-balance text-sm opacity-70">
          {description}
        </p>
      </div>
    </main>
  );
}
