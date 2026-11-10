import React, { useState } from 'react';
import { Link, navigate } from '@reach/router';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import { Button } from '../common/Button';
import { AlertNotice } from '../common/AlertNotice';

export const VerifyEmailForm = () => {
  const { unverifiedEmail, markEmailVerified } = useAuth();
  const [code, setCode] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const verifyMutation = useMutation({
    mutationFn: (data) => authService.verifyEmail(data),
    onSuccess: (res) => {
      markEmailVerified();
      setStatusMessage({
        type: 'success',
        text: res?.message || 'Email successfully verified! Redirecting to dashboard...',
      });
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    },
    onError: (err) => {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Verification failed. Please check the code.',
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => authService.resendVerification(unverifiedEmail),
    onSuccess: (res) => {
      setStatusMessage({
        type: 'success',
        text: res?.message || 'Verification code resent! Please check your inbox.',
      });
    },
    onError: (err) => {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to resend verification code. Please try again later.',
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter the verification code.' });
      return;
    }
    verifyMutation.mutate({ code: code.trim(), email: unverifiedEmail });
  };

  const handleNavigate = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="auth-form-content verify-email-content">
      {statusMessage.text && (
        <AlertNotice
          type={statusMessage.type}
          message={statusMessage.text}
          onClose={() => setStatusMessage({ type: '', text: '' })}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-native-form">
        <div className="verify-code-input-wrapper">
          <input
            id="verification-code"
            name="code"
            type="text"
            className="verification-code-input"
            placeholder="12MP3PD"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={10}
            autoComplete="one-time-code"
            aria-label="Verification code"
            required
          />
        </div>

        <div className="form-submit-row">
          <Button
            type="submit"
            variant="primary"
            isLoading={verifyMutation.isPending}
            fullWidth
          >
            Verify Code
          </Button>
        </div>
      </form>

      {/* Secondary Actions matching Image 2 */}
      <div className="verify-email-actions">
        <button
          type="button"
          onClick={() => resendMutation.mutate()}
          disabled={resendMutation.isPending}
          className="verify-text-action-link"
        >
          {resendMutation.isPending ? 'Resending code...' : 'Resend verification Email'}
        </button>

        <Link
          to="/login"
          className="verify-text-action-link"
          onClick={handleNavigate('/login')}
        >
          Use another account
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailForm;
