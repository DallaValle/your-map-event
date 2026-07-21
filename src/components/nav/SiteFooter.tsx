/**
 * Thin always-on footer carrying the `your map event` wordmark. Sits directly
 * under the section nav inside the fixed bottom bar.
 */
export function SiteFooter() {
  return (
    <div className="border-t border-black/10 bg-white/95 px-5 py-1.5 text-center text-[11px] opacity-50 backdrop-blur dark:border-white/10 dark:bg-neutral-950/95">
      your map event
    </div>
  );
}
