import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDisplayDate, parseISODate, toISODate, todayISO } from "./dateUtils";
import { useAnimatedMount, useDismiss, usePopoverPosition } from "./popoverUtils";
import "./FormPickers.css";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * Animated calendar dropdown. `value`, `min` and `max` are YYYY-MM-DD strings;
 * onChange receives a YYYY-MM-DD string.
 */
export default function DatePicker({ value, onChange, min, max, ariaLabel = "Chọn ngày", placeholder = "Chọn ngày" }) {
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const didFocus = useRef(false);
  const pendingFocus = useRef(null);

  const minDate = parseISODate(min);
  const maxDate = parseISODate(max);
  const selected = parseISODate(value);
  const today = parseISODate(todayISO());

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(selected || minDate || today));
  const [direction, setDirection] = useState("next");

  const mounted = useAnimatedMount(open);
  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, triggerRef, popRef, close);
  const pos = usePopoverPosition(mounted, triggerRef, popRef, 248);

  const openPicker = () => {
    setView(startOfMonth(parseISODate(value) || minDate || today));
    setDirection("next");
    setOpen(true);
  };

  // Move keyboard focus into the calendar once it has been positioned.
  useEffect(() => {
    if (!open) {
      didFocus.current = false;
      return;
    }
    if (pos && !didFocus.current) {
      didFocus.current = true;
      popRef.current?.querySelector('.fp-day[tabindex="0"]')?.focus({ preventScroll: true });
    }
  }, [open, pos]);

  // Focus a specific day after keyboard navigation changed the visible month.
  useEffect(() => {
    if (!pendingFocus.current) return;
    popRef.current?.querySelector(`[data-iso="${pendingFocus.current}"]`)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [view]);

  const isDisabled = (date) => Boolean((minDate && date < minDate) || (maxDate && date > maxDate));

  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month, 1 - offset + i);
    return { date, iso: toISODate(date), inMonth: date.getMonth() === month, disabled: isDisabled(date) };
  });

  const selectedIso = selected ? toISODate(selected) : null;
  const todayIsoStr = toISODate(today);
  const inView = (iso) => cells.some((c) => c.iso === iso && c.inMonth && !c.disabled);
  const tabIso = (selectedIso && inView(selectedIso) && selectedIso) || (inView(todayIsoStr) && todayIsoStr) || cells.find((c) => c.inMonth && !c.disabled)?.iso;

  const changeMonth = (delta) => {
    setDirection(delta > 0 ? "next" : "prev");
    setView(new Date(year, month + delta, 1));
  };
  const prevDisabled = Boolean(minDate && new Date(year, month, 0) < minDate);
  const nextDisabled = Boolean(maxDate && new Date(year, month + 1, 1) > maxDate);

  const pick = (iso) => {
    onChange?.(iso);
    close(true);
  };

  const onGridKeyDown = (event) => {
    const iso = event.target.dataset?.iso;
    if (!iso) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = parseISODate(iso);
    next.setDate(next.getDate() + delta);
    if (isDisabled(next)) return;
    const nextIso = toISODate(next);
    if (next.getMonth() !== month || next.getFullYear() !== year) {
      pendingFocus.current = nextIso;
      setDirection(delta > 0 ? "next" : "prev");
      setView(startOfMonth(next));
    } else {
      popRef.current?.querySelector(`[data-iso="${nextIso}"]`)?.focus({ preventScroll: true });
    }
  };

  const display = formatDisplayDate(value);
  const todayDisabled = isDisabled(today);

  return (
    <div className={`fp-root ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="hc-input fp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={display ? `${ariaLabel}: ${display}` : ariaLabel}
        onClick={() => (open ? close(false) : openPicker())}
      >
        <i className="bi bi-calendar3 fp-trigger-icon" aria-hidden="true" />
        <span className={`fp-trigger-text ${display ? "" : "is-placeholder"}`}>{display || placeholder}</span>
        <i className="bi bi-chevron-down fp-chevron" aria-hidden="true" />
      </button>

      {mounted &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            className={`fp-pop fp-calendar ${open ? "" : "is-closing"} ${pos?.up ? "is-up" : ""}`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width, visibility: pos ? "visible" : "hidden" }}
          >
            <div className="fp-cal-head">
              <button type="button" className="fp-nav" aria-label="Tháng trước" onClick={() => changeMonth(-1)} disabled={prevDisabled}>
                <i className="bi bi-chevron-left" />
              </button>
              <div className="fp-cal-title" aria-live="polite">
                Tháng {month + 1}, {year}
              </div>
              <button type="button" className="fp-nav" aria-label="Tháng sau" onClick={() => changeMonth(1)} disabled={nextDisabled}>
                <i className="bi bi-chevron-right" />
              </button>
            </div>

            <div className="fp-weekdays" aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="fp-grid-wrap">
              <div key={`${year}-${month}`} className={`fp-grid fp-slide-${direction}`} onKeyDown={onGridKeyDown}>
                {cells.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    data-iso={c.iso}
                    tabIndex={c.iso === tabIso ? 0 : -1}
                    disabled={c.disabled}
                    aria-label={formatDisplayDate(c.iso)}
                    aria-pressed={c.iso === selectedIso}
                    className={`fp-day ${c.inMonth ? "" : "is-outside"} ${c.iso === todayIsoStr ? "is-today" : ""} ${c.iso === selectedIso ? "is-selected" : ""}`}
                    onClick={() => pick(c.iso)}
                  >
                    {c.date.getDate()}
                  </button>
                ))}
              </div>
            </div>

            <div className="fp-foot">
              <button type="button" className="fp-foot-btn" onClick={() => pick(todayISO())} disabled={todayDisabled}>
                Hôm nay
              </button>
              <button type="button" className="fp-foot-btn is-muted" onClick={() => close(true)}>
                Đóng
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
