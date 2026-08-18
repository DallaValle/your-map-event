function formatSentAt(date: Date) {
  const delta = Date.now() - date.getTime();
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h ago`;
  return date.toLocaleDateString();
}

export function AnnouncementList({
  items,
}: {
  items: { id: string; title: string; body: string; authorName: string; createdAt: Date }[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/20 px-4 py-10 text-center text-sm opacity-60 dark:border-white/25">
        No announcements sent yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 truncate font-medium">{item.title}</h3>
            <time
              dateTime={item.createdAt.toISOString()}
              className="shrink-0 text-xs opacity-60"
            >
              {formatSentAt(item.createdAt)}
            </time>
          </div>
          <p className="text-sm opacity-80">{item.body}</p>
          <p className="text-xs opacity-50">Sent by {item.authorName}</p>
        </li>
      ))}
    </ul>
  );
}
