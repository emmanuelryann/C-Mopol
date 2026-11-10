import React, { useState } from 'react';
import { Link, useLocation } from '@reach/router';
import { useAuth } from '../../context/AuthContext';
import { SunLogo } from './SunLogo';
import { SideNav } from './SideNav';
import { Overlay } from './Overlay';

export const Navbar = () => {
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  let location = {};
  try {
    location = useLocation();
  } catch {
    location = { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' };
  }
  const currentPath = location?.pathname || '/';

  const toggleSideNav = () => {
    setIsSideNavOpen((prev) => !prev);
  };

  const closeSideNav = () => {
    setIsSideNavOpen(false);
  };

  return (
    <>
      <header className="main-site-navbar">
        <div className="navbar-container">
          {/* Brand Logo & Title */}
          <Link to="/" className="navbar-brand-link" onClick={closeSideNav}>
            <SunLogo size="clamp(2rem, 3.5vw, 2.5rem)" />
            <span className="navbar-brand-name">C-Mopol</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-navbar-nav" aria-label="Main Navigation">
            <Link
              to="/login"
              className={`nav-menu-item ${currentPath === '/login' || currentPath === '/' ? 'active' : ''}`}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className={`nav-menu-item ${currentPath === '/signup' ? 'active' : ''}`}
            >
              Sign Up
            </Link>
            <Link
              to="/verify-email"
              className={`nav-menu-item ${currentPath === '/verify-email' ? 'active' : ''}`}
            >
              Verify Email
            </Link>
            <Link
              to="/forgot-password"
              className={`nav-menu-item ${currentPath === '/forgot-password' ? 'active' : ''}`}
            >
              Forgot Password
            </Link>
            <Link
              to="/security"
              className={`nav-menu-item ${currentPath === '/security' ? 'active' : ''}`}
            >
              Security
            </Link>

            {isAuthenticated ? (
              <div className="navbar-user-actions">
                <Link to="/dashboard" className="navbar-user-chip">
                  <span className="user-initial">
                    {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className="user-short-name">{user?.firstName || 'Account'}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="navbar-logout-btn"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/signup" className="navbar-cta-button">
                Get Started
              </Link>
            )}
          </nav>

          {/* Hamburger / Animated X Button on smaller screens */}
          <button
            type="button"
            className={`hamburger-toggle-btn ${isSideNavOpen ? 'is-active' : ''}`}
            onClick={toggleSideNav}
            aria-expanded={isSideNavOpen}
            aria-label={isSideNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <span className="hamburger-bar bar-top" />
            <span className="hamburger-bar bar-middle" />
            <span className="hamburger-bar bar-bottom" />
          </button>
        </div>
      </header>

      {/* Transparent backdrop overlay */}
      <Overlay isOpen={isSideNavOpen} onClose={closeSideNav} />

      {/* Side Navigation Drawer sliding from the right */}
      <SideNav isOpen={isSideNavOpen} onClose={closeSideNav} />
    </>
  );
};

export default Navbar;
