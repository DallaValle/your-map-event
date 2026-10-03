"use client";

import { useRef, type PointerEvent } from "react";

/** A pull this far, or a quick flick, dismisses the sheet. */
const CLOSE_DISTANCE = 96;
const FLICK_SPEED = 0.6; // px per ms
const FLICK_MIN = 24;

/**
 * Pull a bottom sheet down by its grab area to close it. Spread the returned
 * props on the grab area; the sheet is its closest `[data-sheet]` ancestor.
 */
export function useDragToClose(onClose: () => void) {
  const drag = useRef<{ sheet: HTMLElement; y: number; t: number; dy: number } | null>(null);

  function end(e: PointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const speed = d.dy / Math.max(1, e.timeStamp - d.t);
    if (!cancelled && (d.dy > CLOSE_DISTANCE || (d.dy > FLICK_MIN && speed > FLICK_SPEED))) {
      onClose();
      return;
    }
    d.sheet.style.transition = "transform 200ms ease-out";
    d.sheet.style.transform = "";
  }

  return {
    "data-sheet-grab": "",
    style: { touchAction: "none" } as const,
    onPointerDown(e: PointerEvent<HTMLElement>) {
      // Buttons and fields inside the grab area keep their own taps.
      if (e.button !== 0 || (e.target as Element).closest("button, input, a, [role=group]")) return;
      const sheet = e.currentTarget.closest<HTMLElement>("[data-sheet]");
      if (!sheet) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      sheet.style.transition = "none";
      drag.current = { sheet, y: e.clientY, t: e.timeStamp, dy: 0 };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y);
      d.sheet.style.transform = `translateY(${d.dy}px)`;
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => end(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e, true),
  };
}
