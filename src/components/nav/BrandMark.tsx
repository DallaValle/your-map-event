/**
 * Product mark. Light and dark files swap with `.dark` so Black & white
 * still gets a high-contrast pin.
 */
export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-lg ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-light.png"
        alt=""
        width={size}
        height={size}
        className="size-full object-cover dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-dark.png"
        alt=""
        width={size}
        height={size}
        className="hidden size-full object-cover dark:block"
      />
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      your map <span className="text-brand">event</span>
    </span>
  );
}
