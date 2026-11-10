import React, { useState } from 'react';
import { Link, navigate, useParams } from '@reach/router';
import { useMutation } from '@tanstack/react-query';
import authService from '../../services/authService';
import { InputField } from '../common/InputField';
import { Button } from '../common/Button';
import { AlertNotice } from '../common/AlertNotice';

export const ResetPasswordForm = ({ token: propToken = '' }) => {
  let params = {};
  try {
    params = useParams() || {};
  } catch {
    params = {};
  }
  const urlToken = propToken || params?.token || '';

  const [formData, setFormData] = useState({
    token: urlToken,
    password: '',
    confirmPassword: '',
  });
  const [clientErrors, setClientErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const resetMutation = useMutation({
    mutationFn: ({ token, password }) => authService.resetPassword({ token, password }),
    onSuccess: (data) => {
      setSuccessMessage(data?.message || 'Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const errors = {};
    const effectiveToken = formData.token.trim();
    if (!effectiveToken) {
      errors.token = 'Reset token is required.';
    }
    if (!formData.password) {
      errors.password = 'New password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    resetMutation.mutate({
      token: formData.token.trim(),
      password: formData.password,
    });
  };

  const handleNavigate = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="auth-form-content">
      {successMessage && <AlertNotice type="success" message={successMessage} />}

      {resetMutation.isError && (
        <AlertNotice
          type="error"
          message={resetMutation.error?.message || 'Password reset failed.'}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-native-form">
        {!urlToken && (
          <InputField
            id="reset-token"
            name="token"
            label="Reset Token"
            placeholder="Paste your reset token"
            value={formData.token}
            onChange={handleChange}
            error={clientErrors.token}
            required
            helperText="Check your email or server log for your 64-character token"
          />
        )}

        <InputField
          id="reset-password"
          name="password"
          type="password"
          label="New Password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={handleChange}
          error={clientErrors.password}
          required
          autoComplete="new-password"
        />

        <InputField
          id="reset-confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm New Password"
          placeholder="Repeat your new password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={clientErrors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <div className="form-submit-row">
          <Button
            type="submit"
            variant="primary"
            isLoading={resetMutation.isPending}
            fullWidth
          >
            Reset Password
          </Button>
        </div>

        <div className="auth-switch-prompt">
          <Link
            to="/login"
            className="auth-switch-link"
            onClick={handleNavigate('/login')}
          >
            Back to Log in
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordForm;
