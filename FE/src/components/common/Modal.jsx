import React, { useEffect } from "react";
import "./Modal.css";

/**
 * Props:
 *  - isOpen, onClose, title, children, footer, maxWidth   (original API, unchanged)
 *  - icon        Bootstrap-icon class, e.g. "bi-tools"        } any of these four switches the modal
 *  - subtitle    small line under the title                   } to the richer header; leave them out
 *  - accent      CSS colour for the top bar and icon tint     } and the modal looks exactly as before
 *  - headerExtra node (badges, etc.) shown beside the close button
 */
export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = "540px", icon, subtitle, accent, headerExtra }) {
  useEffect(() => {
    function handleKeyDown(e) {
      // If a picker dropdown is open, Escape should only close that dropdown.
      if (e.key === "Escape" && isOpen && !document.querySelector(".fp-pop")) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rich = Boolean(icon || subtitle || accent || headerExtra);

  return (
    <div className="hc-modal-overlay" onClick={onClose}>
      <div
        className={`hc-modal ${rich ? "hc-modal--rich" : ""}`}
        style={{ maxWidth, ...(accent ? { "--modal-accent": accent } : null) }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="hc-modal-header">
          {icon && (
            <div className="hc-modal-icon" aria-hidden="true">
              <i className={`bi ${icon}`}></i>
            </div>
          )}
          <div className="hc-modal-heading">
            <h3 className="hc-modal-title">{title}</h3>
            {subtitle && <div className="hc-modal-subtitle">{subtitle}</div>}
          </div>
          {headerExtra && <div className="hc-modal-extra">{headerExtra}</div>}
          <button type="button" className="hc-modal-close" onClick={onClose} aria-label="Đóng">
            &times;
          </button>
        </div>
        <div className="hc-modal-body">{children}</div>
        {footer && <div className="hc-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
