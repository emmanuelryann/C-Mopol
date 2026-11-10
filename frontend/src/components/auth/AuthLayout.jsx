import React from 'react';
import { navigate } from '@reach/router';
import { SunLogo } from '../common/SunLogo';
import { ArrowLeftIcon } from '../common/Icons';
import { AuthHeroCard } from './AuthHeroCard';
import { AuthLegalFooter } from './AuthLegalFooter';

export const AuthLayout = ({
  title,
  subtitle,
  children,
  heroSlideIndex = 0,
  backTo = null,
  onBack = null,
}) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    }
  };

  return (
    <main className="auth-page-wrapper">
      <div className="auth-split-card">
        {/* Left Column: Form & Interaction */}
        <section className="auth-form-column">
          <div className="auth-form-inner-container">
            {/* Optional Back Button */}
            {(backTo || onBack) && (
              <div className="auth-back-nav-row">
                <button
                  type="button"
                  onClick={handleBack}
                  className="auth-back-nav-btn"
                  aria-label="Go back"
                >
                  <ArrowLeftIcon size="1rem" />
                  <span>Back</span>
                </button>
              </div>
            )}

            {/* Centered Sun Logo */}
            <div className="auth-logo-center-box">
              <SunLogo size="clamp(3rem, 5.5vw, 3.75rem)" />
            </div>

            {/* Title & Subtitle */}
            <header className="auth-header-box">
              <h1 className="auth-primary-title">{title}</h1>
              {subtitle && <p className="auth-subtitle-text">{subtitle}</p>}
            </header>

            {/* Dynamic Form Content */}
            <div className="auth-form-body">{children}</div>

            {/* Legal Disclaimer Footer */}
            <AuthLegalFooter />
          </div>
        </section>

        {/* Right Column: Aesthetic Visual Card */}
        <div className="auth-hero-column">
          <AuthHeroCard initialSlideIndex={heroSlideIndex} />
        </div>
      </div>
    </main>
  );
};

export default AuthLayout;
