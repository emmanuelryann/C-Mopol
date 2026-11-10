import React from 'react';

export const AuthLegalFooter = () => {
  return (
    <footer className="auth-legal-footer">
      <p>
        By continuing you agree to our{' '}
        <a href="#terms" className="legal-link" onClick={(e) => e.preventDefault()}>
          Terms &amp; Conditions
        </a>{' '}
        and acknowledge our{' '}
        <a href="#privacy" className="legal-link" onClick={(e) => e.preventDefault()}>
          Privacy Policy
        </a>
        .
      </p>
    </footer>
  );
};

export default AuthLegalFooter;
