import React from 'react';
import { AlertCircleIcon, CheckIcon } from './Icons';

export const AlertNotice = ({ type = 'error', message, onClose }) => {
  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <div className={`alert-notice-box alert-${type}`} role="alert">
      <span className="alert-icon-wrapper">
        {isSuccess ? <CheckIcon /> : <AlertCircleIcon />}
      </span>
      <div className="alert-message-text">{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="alert-close-btn"
          aria-label="Dismiss message"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default AlertNotice;
