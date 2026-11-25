import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/** Keeps a popover mounted while its closing animation plays. */
export function useAnimatedMount(open, duration = 190) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);
  return mounted;
}

/**
 * Positions a fixed popover under (or above, if there is no room) its trigger and keeps it
 * in the viewport. Returns null until the first measurement, so callers can hide it for that frame.
 */
export function usePopoverPosition(active, triggerRef, popRef, minWidth = 0) {
  const [pos, setPos] = useState(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const anchor = trigger.closest("[data-fp-anchor]") || trigger;
    const rect = anchor.getBoundingClientRect();
    // Popover is exactly as wide as the field it belongs to (never narrower than minWidth).
    const width = Math.max(rect.width, minWidth);
    pop.style.width = `${width}px`;
    const height = pop.offsetHeight;
    const gap = 8;
    const edge = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    if (left + width > vw - edge) left = rect.right - width;
    left = Math.max(edge, Math.min(left, vw - width - edge));

    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const up = height > spaceBelow && spaceAbove > spaceBelow;
    setPos({ left, top: up ? rect.top - height - gap : rect.bottom + gap, up, width });
  }, [triggerRef, popRef, minWidth]);

  useLayoutEffect(() => {
    if (!active) {
      setPos(null);
      return undefined;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, update]);

  return pos;
}

/** Closes on outside press and on Escape. onClose(true) means "return focus to the trigger". */
export function useDismiss(open, triggerRef, popRef, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onPress = (event) => {
      if (triggerRef.current?.contains(event.target) || popRef.current?.contains(event.target)) return;
      onClose(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") onClose(true);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, triggerRef, popRef, onClose]);
}
