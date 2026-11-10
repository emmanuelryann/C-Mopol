import React from 'react';
import { SunLogo } from '../common/SunLogo';
import { AuthHeroCard } from './AuthHeroCard';
import { AuthLegalFooter } from './AuthLegalFooter';

export const AuthLayout = ({
  title,
  subtitle,
  children,
  heroSlideIndex = 0,
}) => {
  return (
    <main className="auth-page-wrapper">
      <div className="auth-split-card">
        {/* Left Column: Form & Interaction */}
        <section className="auth-form-column">
          <div className="auth-form-inner-container">
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
