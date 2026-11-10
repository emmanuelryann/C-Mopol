import React from 'react';
import { SpinnerIcon } from './Icons';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost'
  isLoading = false,
  disabled = false,
  onClick,
  fullWidth = true,
  icon = null,
  className = '',
  ...props
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`btn-base btn-${variant} ${fullWidth ? 'btn-full-width' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="btn-spinner-content">
          <SpinnerIcon />
          <span>Processing...</span>
        </span>
      ) : (
        <span className="btn-inner-content">
          {icon && <span className="btn-icon">{icon}</span>}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
};

export default Button;
