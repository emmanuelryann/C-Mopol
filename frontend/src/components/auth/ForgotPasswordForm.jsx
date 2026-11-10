import React, { useState } from 'react';
import { Link } from '@reach/router';
import { useMutation } from '@tanstack/react-query';
import authService from '../../services/authService';
import { InputField } from '../common/InputField';
import { Button } from '../common/Button';
import { AlertNotice } from '../common/AlertNotice';

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [clientError, setClientError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const forgotMutation = useMutation({
    mutationFn: (emailAddress) => authService.forgotPassword(emailAddress),
    onSuccess: () => {
      setIsSuccess(true);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setClientError('Email address is required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setClientError('Please enter a valid email address.');
      return;
    }
    setClientError('');
    forgotMutation.mutate(email.trim().toLowerCase());
  };

  return (
    <div className="auth-form-content">
      {forgotMutation.isError && (
        <AlertNotice
          type="error"
          message={forgotMutation.error?.message || 'Failed to submit request.'}
        />
      )}

      {isSuccess ? (
        <div className="forgot-password-success-box">
          <AlertNotice
            type="success"
            message={`If an account with ${email} exists, a password reset link has been sent. Check your inbox and spam folder.`}
          />
          <div className="auth-switch-prompt" style={{ marginTop: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
            <Link to="/login" className="auth-switch-link">
              Return to Log in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-native-form">
          <InputField
            id="forgot-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="Example@gmail.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (clientError) setClientError('');
            }}
            error={clientError}
            required
            autoComplete="email"
          />

          <div className="form-submit-row">
            <Button
              type="submit"
              variant="primary"
              isLoading={forgotMutation.isPending}
              fullWidth
            >
              Send Reset Link
            </Button>
          </div>

          <div className="auth-switch-prompt">
            <span>Remember your password? </span>
            <Link to="/login" className="auth-switch-link">
              Log in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
