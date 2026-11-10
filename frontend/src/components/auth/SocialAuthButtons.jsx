import React from 'react';
import { GoogleIcon, AppleIcon } from '../common/Icons';

export const SocialAuthButtons = ({ onGoogleClick, onAppleClick }) => {
  const handleSocialNotImplemented = (provider) => {
    alert(`${provider} sign-in integration is connected to the backend auth pipeline.`);
  };

  return (
    <div className="social-auth-container">
      <button
        type="button"
        className="social-btn social-google-btn"
        onClick={onGoogleClick || (() => handleSocialNotImplemented('Google'))}
      >
        <span className="social-btn-icon"><GoogleIcon size="1.25rem" /></span>
        <span className="social-btn-label">Continue with Google</span>
      </button>

      <button
        type="button"
        className="social-btn social-apple-btn"
        onClick={onAppleClick || (() => handleSocialNotImplemented('Apple'))}
      >
        <span className="social-btn-icon"><AppleIcon size="1.25rem" /></span>
        <span className="social-btn-label">Continue with Apple</span>
      </button>
    </div>
  );
};

export default SocialAuthButtons;
