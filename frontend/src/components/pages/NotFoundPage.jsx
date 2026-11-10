import React from 'react';
import { Link } from '@reach/router';
import { SunLogo } from '../common/SunLogo';

export const NotFoundPage = () => {
  return (
    <div className="not-found-page-wrapper">
      <div className="not-found-card">
        <SunLogo size="clamp(3rem, 6vw, 4rem)" />
        <h1 className="not-found-title">404</h1>
        <h2 className="not-found-subtitle">Page Not Found</h2>
        <p className="not-found-desc">
          The authentication page you are looking for does not exist or has been moved.
        </p>
        <Link to="/login" className="not-found-home-btn">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
