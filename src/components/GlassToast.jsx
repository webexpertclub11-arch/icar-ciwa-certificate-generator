import React from 'react';
import './GlassToast.css';

/**
 * Glassmorphism Loader Overlay Component
 */
export const GlassLoader = ({ isLoading, message = "Refreshing Database Records...", subtext = "Syncing Database & Participant Registries" }) => {
  if (!isLoading) return null;

  return (
    <div className="glass-loader-overlay">
      <div className="glass-loader-card">
        <div className="glass-spinner-ring"></div>
        <h4>{message}</h4>
        <p>{subtext}</p>
      </div>
    </div>
  );
};

/**
 * Glassmorphism Toast Notification Component
 */
export const GlassToast = ({ toast, onClose }) => {
  if (!toast || !toast.text) return null;

  const typeClass = `toast-${toast.type || 'info'}`;
  const icons = {
    success: '✓',
    danger: '⚠️',
    warning: '🔔',
    info: 'ℹ️'
  };

  return (
    <div className="glass-toast-container">
      <div className={`glass-toast-item ${typeClass}`}>
        <span className="toast-icon">{icons[toast.type] || 'ℹ️'}</span>
        <div className="toast-content">
          {toast.title && <span className="toast-title">{toast.title}</span>}
          <span className="toast-message">{toast.text}</span>
        </div>
        {onClose && (
          <button className="toast-close-btn" onClick={onClose} aria-label="Close notification">
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Glassmorphism Confirmation Modal Component
 */
export const GlassConfirmModal = ({ confirmState, onConfirm, onCancel }) => {
  if (!confirmState || !confirmState.isOpen) return null;

  return (
    <div className="glass-loader-overlay" onClick={onCancel}>
      <div className="glass-loader-card glass-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="glass-confirm-icon">❓</div>
        <h4>{confirmState.title || "Confirm Action"}</h4>
        <p>{confirmState.message}</p>
        <div className="glass-confirm-actions">
          <button className="btn-glass-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-glass-confirm" onClick={onConfirm}>
            {confirmState.confirmBtnText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};
