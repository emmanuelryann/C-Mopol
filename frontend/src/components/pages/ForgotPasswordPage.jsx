import React from 'react';
import { AuthLayout } from '../auth/AuthLayout';
import { ForgotPasswordForm } from '../auth/ForgotPasswordForm';

export const ForgotPasswordPage = () => {
  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email to receive recovery instructions."
      heroSlideIndex={3}
      backTo="/login"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
