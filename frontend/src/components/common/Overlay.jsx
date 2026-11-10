import React, { useEffect } from 'react';

export const Overlay = ({ isOpen, onClose }) => {
  // Disable body scroll when overlay is active
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
      className="mobile-backdrop-overlay"
      onClick={onClose}
      aria-label="Close navigation overlay"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    />
  );
};

export default Overlay;
