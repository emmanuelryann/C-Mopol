import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './Icons';

export const InputField = ({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error = '',
  rightLabelAction = null,
  autoComplete,
  icon = null,
  disabled = false,
  helperText = '',
  className = '',
  inputClassName = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`form-field-group ${className}`}>
      {(label || rightLabelAction) && (
        <div className="form-field-header">
          {label && (
            <label htmlFor={id || name} className="form-field-label">
              {label} {required && <span className="required-star">*</span>}
            </label>
          )}
          {rightLabelAction && (
            <div className="form-field-right-action">{rightLabelAction}</div>
          )}
        </div>
      )}

      <div className={`input-box-wrapper ${error ? 'has-error' : ''}`}>
        {icon && <span className="input-leading-icon">{icon}</span>}

        <input
          id={id || name}
          name={name}
          type={effectiveType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`input-base-control ${inputClassName}`}
        />

        {isPassword && (
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {error ? (
        <p className="field-error-text" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="field-helper-text">{helperText}</p>
      ) : null}
    </div>
  );
};

export default InputField;
