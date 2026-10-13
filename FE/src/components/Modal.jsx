import React, { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '540px' }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hc-modal-overlay" onClick={onClose}>
      <div 
        className="hc-modal" 
        style={{ maxWidth }} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="hc-modal-header">
          <h3 className="hc-modal-title">{title}</h3>
          <button 
            type="button" 
            className="hc-modal-close" 
            onClick={onClose}
            aria-label="Đóng"
          >
            &times;
          </button>
        </div>
        <div className="hc-modal-body">
          {children}
        </div>
        {footer && (
          <div className="hc-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
