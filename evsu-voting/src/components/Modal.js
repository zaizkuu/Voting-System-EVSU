"use client";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card glass-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
