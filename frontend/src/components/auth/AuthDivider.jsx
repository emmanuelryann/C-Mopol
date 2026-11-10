import React from 'react';

export const AuthDivider = ({ text = 'OR' }) => {
  return (
    <div className="auth-divider-container" role="separator">
      <span className="auth-divider-line" />
      <span className="auth-divider-text">{text}</span>
      <span className="auth-divider-line" />
    </div>
  );
};

export default AuthDivider;
