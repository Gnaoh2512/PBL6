import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnimatedMount, useDismiss, usePopoverPosition } from "./popoverUtils";
import "./FormPickers.css";

/**
 * Animated replacement for a native <select>.
 * options: [{ value, label }]. onChange receives the option's value.
 */
export default function SelectMenu({ value, onChange, options, ariaLabel = "Chọn", icon = "bi-people" }) {
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
  const pos = usePopoverPosition(mounted, triggerRef, popRef, 140);

  const current = options.find((o) => String(o.value) === String(value));
  const label = current ? current.label : String(value ?? "");

  useEffect(() => {
    if (!open) {
      didFocus.current = false;
      return;
    }
    if (pos && !didFocus.current) {
      didFocus.current = true;
      const target = popRef.current?.querySelector(".fp-option.is-selected") || popRef.current?.querySelector(".fp-option");
      target?.focus({ preventScroll: true });
    }
  }, [open, pos]);

  const choose = (optionValue) => {
    onChange?.(String(optionValue));
    close(true);
  };

  const onTriggerKeyDown = (event) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event) => {
    const items = Array.from(popRef.current?.querySelectorAll(".fp-option") || []);
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (event.key === "ArrowDown") next = items[Math.min(index + 1, items.length - 1)];
    if (event.key === "ArrowUp") next = items[Math.max(index - 1, 0)];
    if (event.key === "Home") next = items[0];
    if (event.key === "End") next = items[items.length - 1];
    if (next) {
      event.preventDefault();
      next.focus({ preventScroll: true });
    }
    if (event.key === "Tab") close(false);
  };

  return (
    <div className={`fp-root ${open ? "is-open" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        className="hc-input fp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${label}`}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
      >
        <i className={`bi ${icon} fp-trigger-icon`} aria-hidden="true" />
        <span className="fp-trigger-text">{label}</span>
        <i className="bi bi-chevron-down fp-chevron" aria-hidden="true" />
      </button>

      {mounted &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            aria-label={ariaLabel}
            className={`fp-pop fp-menu ${open ? "" : "is-closing"} ${pos?.up ? "is-up" : ""}`}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width, visibility: pos ? "visible" : "hidden" }}
            onKeyDown={onMenuKeyDown}
          >
            {options.map((option, i) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`fp-option ${isSelected ? "is-selected" : ""}`}
                  style={{ "--i": i }}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  <i className="bi bi-check2" aria-hidden="true" />
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
