import type { ReactNode } from "react";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M21 12a9 9 0 0 1-9 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Label that shows a spinner while an action is in flight. */
export function PendingLabel({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: ReactNode;
  pendingLabel?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      {pending ? <Spinner /> : null}
      <span>{pending ? (pendingLabel ?? label) : label}</span>
    </span>
  );
}
