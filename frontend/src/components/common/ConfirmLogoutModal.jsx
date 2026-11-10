import React, { useEffect } from 'react';
import { Button } from './Button';
import { AlertCircleIcon } from './Icons';

export const ConfirmLogoutModal = ({ isOpen, onClose, onConfirm, isLoading = false }) => {
  // Lock body scroll while modal is visible
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
    >
      <div
        className="modal-dialog-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon-badge">
          <AlertCircleIcon size="1.5rem" />
        </div>

        <h2 id="logout-modal-title" className="modal-dialog-title">
          Confirm Sign Out
        </h2>

        <p className="modal-dialog-desc">
          Are you sure you want to sign out of your account? You will need to sign in again to access your dashboard and saved preferences.
        </p>

        <div className="modal-actions-row">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            fullWidth={false}
            className="modal-cancel-btn"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            isLoading={isLoading}
            fullWidth={false}
            className="modal-confirm-btn"
          >
            Yes, Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmLogoutModal;
