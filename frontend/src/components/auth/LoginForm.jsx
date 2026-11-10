import React, { useState } from 'react';
import { Link, navigate } from '@reach/router';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import { InputField } from '../common/InputField';
import { Button } from '../common/Button';
import { AlertNotice } from '../common/AlertNotice';
import { SocialAuthButtons } from './SocialAuthButtons';
import { AuthDivider } from './AuthDivider';

export const LoginForm = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [clientErrors, setClientErrors] = useState({});

  const loginMutation = useMutation({
    mutationFn: (credentials) => authService.login(credentials),
    onSuccess: (data) => {
      if (data?.user) {
        login(data.user);
      }
      navigate('/dashboard');
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
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    loginMutation.mutate({
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    });
  };

  const handleNavigate = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="auth-form-content">
      {/* Social Logins */}
      <SocialAuthButtons />

      {/* Divider */}
      <AuthDivider text="OR" />

      {/* Backend API Error Banner */}
      {loginMutation.isError && (
        <AlertNotice
          type="error"
          message={loginMutation.error?.message || 'Login failed. Please verify credentials.'}
        />
      )}

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} noValidate className="auth-native-form">
        <InputField
          id="login-email"
          name="email"
          type="email"
          label="Email address"
          placeholder="Example@gmail.com"
          value={formData.email}
          onChange={handleChange}
          error={clientErrors.email}
          required
          autoComplete="email"
        />

        <InputField
          id="login-password"
          name="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          error={clientErrors.password}
          required
          autoComplete="current-password"
          rightLabelAction={
            <Link
              to="/forgot-password"
              className="forgot-password-link"
              onClick={handleNavigate('/forgot-password')}
            >
              Forgot Password?
            </Link>
          }
        />

        <div className="form-submit-row">
          <Button
            type="submit"
            variant="primary"
            isLoading={loginMutation.isPending}
            fullWidth
          >
            Log in
          </Button>
        </div>
      </form>

      {/* Switch to Sign Up */}
      <div className="auth-switch-prompt">
        <span>Don't have account yet? </span>
        <Link
          to="/signup"
          className="auth-switch-link"
          onClick={handleNavigate('/signup')}
        >
          Sign up
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
