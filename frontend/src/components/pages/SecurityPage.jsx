import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import { InputField } from '../common/InputField';
import { Button } from '../common/Button';
import { AlertNotice } from '../common/AlertNotice';
import { ShieldCheckIcon, MonitorIcon } from '../common/Icons';

export const SecurityPage = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', text: '' });
  const [sessionStatus, setSessionStatus] = useState({ type: '', text: '' });

  // Query active sessions from backend
  const {
    data: sessionsData,
    isLoading: isSessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => authService.getSessions(),
    enabled: isAuthenticated,
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: (res) => {
      setPasswordStatus({
        type: 'success',
        text: res?.message || 'Password changed successfully! You will need to re-login on next visit.',
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => {
      setPasswordStatus({
        type: 'error',
        text: err?.message || 'Failed to change password.',
      });
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId) => authService.revokeSession(sessionId),
    onSuccess: (res) => {
      setSessionStatus({
        type: 'success',
        text: res?.message || 'Session revoked successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err) => {
      setSessionStatus({
        type: 'error',
        text: err?.message || 'Failed to revoke session.',
      });
    },
  });

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword) {
      setPasswordStatus({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordStatus({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  return (
    <div className="security-page-container">
      <div className="security-header-section">
        <h1 className="security-page-title">Account Security &amp; Sessions</h1>
        <p className="security-page-subtitle">
          Manage your active device logins, session limits, and account password.
        </p>
      </div>

      <div className="security-cards-grid">
        {/* Change Password Card */}
        <section className="security-card">
          <div className="security-card-header">
            <span className="security-header-icon"><ShieldCheckIcon size="1.25rem" /></span>
            <div>
              <h2 className="security-card-title">Change Password</h2>
              <p className="security-card-desc">Update your password to keep your account safe.</p>
            </div>
          </div>

          {passwordStatus.text && (
            <AlertNotice
              type={passwordStatus.type}
              message={passwordStatus.text}
              onClose={() => setPasswordStatus({ type: '', text: '' })}
            />
          )}

          <form onSubmit={handlePasswordSubmit} className="security-form">
            <InputField
              id="currentPassword"
              name="currentPassword"
              type="password"
              label="Current Password"
              placeholder="Enter current password"
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))
              }
              required
            />

            <InputField
              id="newPassword"
              name="newPassword"
              type="password"
              label="New Password"
              placeholder="At least 8 characters"
              value={passwordData.newPassword}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
              }
              required
            />

            <InputField
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm New Password"
              placeholder="Repeat new password"
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              required
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={changePasswordMutation.isPending}
              disabled={!isAuthenticated}
            >
              {isAuthenticated ? 'Update Password' : 'Sign in to Change Password'}
            </Button>
          </form>
        </section>

        {/* Active Sessions Card */}
        <section className="security-card">
          <div className="security-card-header">
            <span className="security-header-icon"><MonitorIcon size="1.25rem" /></span>
            <div>
              <h2 className="security-card-title">Active Device Sessions</h2>
              <p className="security-card-desc">
                Backend limits active logins to <strong>2 devices maximum</strong>.
              </p>
            </div>
          </div>

          {sessionStatus.text && (
            <AlertNotice
              type={sessionStatus.type}
              message={sessionStatus.text}
              onClose={() => setSessionStatus({ type: '', text: '' })}
            />
          )}

          {isSessionsLoading ? (
            <div className="security-sessions-loading">Loading active sessions...</div>
          ) : sessionsError ? (
            <div className="security-sessions-empty">
              Please <a href="/login">sign in</a> to view active sessions.
            </div>
          ) : sessionsData?.sessions?.length ? (
            <div className="security-sessions-list">
              {sessionsData.sessions.map((sess) => (
                <div key={sess._id} className="session-item-row">
                  <div className="session-item-info">
                    <div className="session-device-name">
                      {sess.userAgent?.includes('Mac')
                        ? 'Apple Mac'
                        : sess.userAgent?.includes('Windows')
                        ? 'Windows PC'
                        : sess.userAgent?.includes('iPhone')
                        ? 'iPhone'
                        : sess.userAgent?.includes('Android')
                        ? 'Android Device'
                        : 'Web Browser'}
                      {sess.isCurrent && <span className="session-current-tag">This Device</span>}
                    </div>
                    <div className="session-meta-info">
                      <span>IP: {sess.ipAddress}</span>
                      <span>•</span>
                      <span>Last active: {new Date(sess.lastActiveAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      fullWidth={false}
                      isLoading={revokeSessionMutation.isPending}
                      onClick={() => revokeSessionMutation.mutate(sess._id)}
                      className="session-revoke-btn"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="security-sessions-empty">
              No remote sessions active. You are securely logged in on this browser.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SecurityPage;
