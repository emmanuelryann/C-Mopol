import React from 'react';
import { Link, useLocation } from '@reach/router';
import { useAuth } from '../../context/AuthContext';
import { SunLogo } from './SunLogo';
import {
  LockIcon,
  UserIcon,
  ShieldCheckIcon,
  MailIcon,
  KeyIcon,
} from './Icons';

export const SideNav = ({ isOpen, onClose }) => {
  const { user, isAuthenticated, logout } = useAuth();

  let location = {};
  try {
    location = useLocation();
  } catch {
    location = { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' };
  }
  const currentPath = location?.pathname || '/';

  const handleLinkClick = () => {
    onClose();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const navLinks = [
    { to: '/login', label: 'Log In', icon: <UserIcon size="1.125rem" /> },
    { to: '/signup', label: 'Sign Up', icon: <LockIcon size="1.125rem" /> },
    { to: '/verify-email', label: 'Verify Email', icon: <MailIcon size="1.125rem" /> },
    { to: '/forgot-password', label: 'Forgot Password', icon: <KeyIcon size="1.125rem" /> },
    { to: '/reset-password', label: 'Reset Password', icon: <KeyIcon size="1.125rem" /> },
    { to: '/security', label: 'Security & Sessions', icon: <ShieldCheckIcon size="1.125rem" /> },
  ];

  return (
    <aside
      className={`side-navbar-drawer ${isOpen ? 'is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label="Mobile side navigation"
    >
      <div className="side-nav-header">
        <Link to="/" className="side-nav-brand" onClick={handleLinkClick}>
          <SunLogo size="clamp(2rem, 4vw, 2.5rem)" />
          <span className="side-nav-title">C-Mopol</span>
        </Link>
      </div>

      {isAuthenticated && user && (
        <div className="side-nav-user-badge">
          <div className="user-avatar-circle">
            {user.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info-text">
            <div className="user-name">{user.firstName} {user.lastName}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      )}

      <div className="side-nav-section-title">AUTHENTICATION PAGES</div>

      <nav className="side-nav-menu">
        {navLinks.map((item) => {
          const isActive = currentPath === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`side-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={handleLinkClick}
            >
              <span className="side-nav-icon">{item.icon}</span>
              <span className="side-nav-text">{item.label}</span>
              {isActive && <span className="side-nav-indicator" />}
            </Link>
          );
        })}

        {isAuthenticated && (
          <Link
            to="/dashboard"
            className={`side-nav-link ${currentPath === '/dashboard' ? 'is-active' : ''}`}
            onClick={handleLinkClick}
          >
            <span className="side-nav-icon"><UserIcon size="1.125rem" /></span>
            <span className="side-nav-text">Account Dashboard</span>
          </Link>
        )}
      </nav>

      <div className="side-nav-footer">
        {isAuthenticated ? (
          <button
            type="button"
            className="side-nav-logout-btn"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        ) : (
          <Link
            to="/login"
            className="side-nav-primary-cta"
            onClick={handleLinkClick}
          >
            Sign In Now
          </Link>
        )}
      </div>
    </aside>
  );
};

export default SideNav;
