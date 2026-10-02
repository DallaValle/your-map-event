import type { LucideIcon } from "lucide-react";

const SIZES = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSize = keyof typeof SIZES;

/**
 * The one way to draw an interface icon. Strokes use currentColor so icons
 * follow the theme tokens and hover/disabled states of their parent.
 * Decorative by default; pass `label` when the icon is the only content.
 */
export function Icon({
  icon: Glyph,
  size = "md",
  label,
  className,
}: {
  icon: LucideIcon;
  size?: IconSize;
  label?: string;
  className?: string;
}) {
  const px = SIZES[size];
  return (
    <Glyph
      width={px}
      height={px}
      strokeWidth={2}
      absoluteStrokeWidth={px > 24}
      className={`shrink-0 ${className ?? ""}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      focusable="false"
    />
  );
}
