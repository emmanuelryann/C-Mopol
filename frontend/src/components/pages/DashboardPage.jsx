import React from 'react';
import { Link, navigate } from '@reach/router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { ShieldCheckIcon, MailIcon, UserIcon } from '../common/Icons';

export const DashboardPage = () => {
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page-container">
      <div className="dashboard-hero-banner">
        <div className="dashboard-hero-content">
          <div className="dashboard-welcome-tag">MEMBER OVERVIEW</div>
          <h1 className="dashboard-welcome-title">
            Welcome back, {user?.firstName ? `${user.firstName}!` : 'Explorer!'}
          </h1>
          <p className="dashboard-welcome-desc">
            You are securely authenticated into the C-Mopol platform.
          </p>
        </div>

        <div className="dashboard-quick-actions">
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      </div>

      <div className="dashboard-cards-grid">
        {/* Profile Card */}
        <section className="dashboard-summary-card">
          <div className="summary-card-header">
            <span className="summary-card-icon"><UserIcon size="1.25rem" /></span>
            <h2 className="summary-card-title">Profile Summary</h2>
          </div>

          <div className="summary-details-list">
            <div className="summary-detail-row">
              <span className="detail-label">Full Name</span>
              <span className="detail-value">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : 'Guest User'}
              </span>
            </div>

            <div className="summary-detail-row">
              <span className="detail-label">Email Address</span>
              <span className="detail-value">{user?.email || 'Not signed in'}</span>
            </div>

            <div className="summary-detail-row">
              <span className="detail-label">Email Status</span>
              <span className={`detail-status-pill ${user?.isEmailVerified ? 'verified' : 'unverified'}`}>
                {user?.isEmailVerified ? 'Verified' : 'Pending Verification'}
              </span>
            </div>

            <div className="summary-detail-row">
              <span className="detail-label">Account Role</span>
              <span className="detail-value">{user?.role || 'customer'}</span>
            </div>
          </div>
        </section>

        {/* Verification Status Card */}
        <section className="dashboard-summary-card">
          <div className="summary-card-header">
            <span className="summary-card-icon"><MailIcon size="1.25rem" /></span>
            <h2 className="summary-card-title">Email Verification</h2>
          </div>

          <p className="summary-card-desc">
            {user?.isEmailVerified
              ? 'Your email address has been verified. You have full access to orders, checkouts, and preferences.'
              : 'Your email address has not been verified yet. Verify your email to activate full account features.'}
          </p>

          <div style={{ marginTop: 'clamp(1rem, 2vw, 1.5rem)' }}>
            <Link
              to="/verify-email"
              className="dashboard-action-btn-link"
            >
              {user?.isEmailVerified ? 'View Verification Screen' : 'Verify Email Now'}
            </Link>
          </div>
        </section>

        {/* Security & Sessions Card */}
        <section className="dashboard-summary-card">
          <div className="summary-card-header">
            <span className="summary-card-icon"><ShieldCheckIcon size="1.25rem" /></span>
            <h2 className="summary-card-title">Security &amp; Device Sessions</h2>
          </div>

          <p className="summary-card-desc">
            Review logged in devices, revoke sessions on other devices, or update your password anytime.
          </p>

          <div style={{ marginTop: 'clamp(1rem, 2vw, 1.5rem)' }}>
            <Link to="/security" className="dashboard-action-btn-link">
              Manage Security &amp; Sessions
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
