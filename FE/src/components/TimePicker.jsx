import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnimatedMount, useDismiss, usePopoverPosition } from "./popoverUtils";
import "./FormPickers.css";

const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const parseTime = (value) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
};

/**
 * Animated time dropdown (hour + minute columns), same look as DatePicker / SelectMenu.
 * `value` and onChange use "HH:MM" (24h). Changes apply immediately; "Xong" just closes.
 */
export default function TimePicker({ value, onChange, ariaLabel = "Chọn giờ", placeholder = "--:--", minuteStep = 5 }) {
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const didFocus = useRef(false);
  const [open, setOpen] = useState(false);

  const mounted = useAnimatedMount(open);
  const close = useCallback((refocus) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, triggerRef, popRef, close);
  const pos = usePopoverPosition(mounted, triggerRef, popRef, 208);

  const parsed = parseTime(value);
  const display = parsed ? `${pad(parsed.h)}:${pad(parsed.m)}` : "";

  // Minute list in `minuteStep` steps; keeps an odd existing value (e.g. 06:07) selectable.
  const minutes = useMemo(() => {
    const list = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep).filter((m) => m < 60);
    if (parsed && !list.includes(parsed.m)) list.push(parsed.m);
    return list.sort((a, b) => a - b);
  }, [minuteStep, parsed?.m]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTime = (h, m) => onChange?.(`${pad(h)}:${pad(m)}`);
  const pickHour = (h) => setTime(h, parsed ? parsed.m : 0);
  const pickMinute = (m) => setTime(parsed ? parsed.h : 0, m);

  // Centre the selected hour/minute in each column and focus the hour once positioned.
  useEffect(() => {
    if (!open) {
      didFocus.current = false;
      return;
    }
    if (pos && !didFocus.current) {
      didFocus.current = true;
      popRef.current?.querySelectorAll(".fp-time-col").forEach((col) => {
        const sel = col.querySelector(".is-selected");
        if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
      });
      const target = popRef.current?.querySelector('.fp-time-col[data-col="h"] .is-selected') || popRef.current?.querySelector(".fp-time-opt");
      target?.focus({ preventScroll: true });
    }
  }, [open, pos]);

  const onTriggerKeyDown = (event) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onColumnsKeyDown = (event) => {
    const btn = event.target.closest?.(".fp-time-opt");
    if (!btn) return;
    const col = btn.closest(".fp-time-col");
    const items = Array.from(col.querySelectorAll(".fp-time-opt"));
    const index = items.indexOf(btn);
    let next = null;
    if (event.key === "ArrowDown") next = items[Math.min(index + 1, items.length - 1)];
    if (event.key === "ArrowUp") next = items[Math.max(index - 1, 0)];
    if (event.key === "Home") next = items[0];
    if (event.key === "End") next = items[items.length - 1];
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const otherKey = col.dataset.col === "h" ? "m" : "h";
      if ((event.key === "ArrowRight") === (col.dataset.col === "h")) {
        const other = popRef.current?.querySelector(`.fp-time-col[data-col="${otherKey}"]`);
        next = other?.querySelector(".is-selected") || other?.querySelector(".fp-time-opt");
      }
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
    if (event.key === "Tab") close(false);
  };

  return (
    <div className={`fp-root ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="hc-input fp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={display ? `${ariaLabel}: ${display}` : ariaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
      >
        <i className="bi bi-clock fp-trigger-icon" aria-hidden="true" />
        <span className={`fp-trigger-text ${display ? "" : "is-placeholder"}`}>{display || placeholder}</span>
        <i className="bi bi-chevron-down fp-chevron" aria-hidden="true" />
      </button>

      {mounted &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            className={`fp-pop fp-timepop ${open ? "" : "is-closing"} ${pos?.up ? "is-up" : ""}`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width, visibility: pos ? "visible" : "hidden" }}
          >
            <div className="fp-time-cols" onKeyDown={onColumnsKeyDown}>
              <div className="fp-time-colwrap">
                <div className="fp-time-head">Giờ</div>
                <div className="fp-time-col" data-col="h">
                  {HOURS.map((h) => (
                    <button key={h} type="button" tabIndex={-1} aria-pressed={parsed?.h === h} className={`fp-time-opt ${parsed?.h === h ? "is-selected" : ""}`} onClick={() => pickHour(h)}>
                      {pad(h)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fp-time-colwrap">
                <div className="fp-time-head">Phút</div>
                <div className="fp-time-col" data-col="m">
                  {minutes.map((m) => (
                    <button key={m} type="button" tabIndex={-1} aria-pressed={parsed?.m === m} className={`fp-time-opt ${parsed?.m === m ? "is-selected" : ""}`} onClick={() => pickMinute(m)}>
                      {pad(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="fp-foot">
              <span className="fp-time-value">{display || placeholder}</span>
              <button type="button" className="fp-foot-btn" onClick={() => close(true)}>
                Xong
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
