/**
 * Product mark. The SVG is used as a mask and filled with `--brand`, so one
 * file follows every theme (light, dark, black and white).
 */
export function BrandMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-brand [mask:url(/brand/mark.svg)_center/contain_no-repeat] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      your map <span className="text-brand">event</span>
    </span>
  );
}
