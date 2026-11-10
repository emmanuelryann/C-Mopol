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

export const RegisterForm = () => {
  const { login, setUnverifiedEmail } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [clientErrors, setClientErrors] = useState({});

  const registerMutation = useMutation({
    mutationFn: (userData) => authService.register(userData),
    onSuccess: (data) => {
      if (data?.data?.user) {
        login(data.data.user);
      }
      setUnverifiedEmail(formData.email.trim());
      navigate('/verify-email');
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
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required.';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required.';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please provide a valid email address.';
    }
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    registerMutation.mutate({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim() || undefined,
      password: formData.password,
    });
  };

  const handleNavigate = (path) => (e) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="auth-form-content">
      <SocialAuthButtons />

      <AuthDivider text="OR" />

      {registerMutation.isError && (
        <AlertNotice
          type="error"
          message={registerMutation.error?.message || 'Registration failed. Please check inputs.'}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-native-form">
        {/* Name Fields side by side */}
        <div className="form-fields-flex-row">
          <InputField
            id="register-firstName"
            name="firstName"
            label="First Name"
            placeholder="John"
            value={formData.firstName}
            onChange={handleChange}
            error={clientErrors.firstName}
            required
            className="flex-field-item"
          />

          <InputField
            id="register-lastName"
            name="lastName"
            label="Last Name"
            placeholder="Doe"
            value={formData.lastName}
            onChange={handleChange}
            error={clientErrors.lastName}
            required
            className="flex-field-item"
          />
        </div>

        <InputField
          id="register-email"
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
          id="register-phone"
          name="phone"
          type="tel"
          label="Phone number"
          placeholder="+1 (555) 000-0000 (optional)"
          value={formData.phone}
          onChange={handleChange}
          autoComplete="tel"
        />

        <InputField
          id="register-password"
          name="password"
          type="password"
          label="Password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={handleChange}
          error={clientErrors.password}
          required
          autoComplete="new-password"
        />

        <div className="form-submit-row">
          <Button
            type="submit"
            variant="primary"
            isLoading={registerMutation.isPending}
            fullWidth
          >
            Create Account
          </Button>
        </div>
      </form>

      <div className="auth-switch-prompt">
        <span>Already have an account? </span>
        <Link
          to="/login"
          className="auth-switch-link"
          onClick={handleNavigate('/login')}
        >
          Log in
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;
