import React from 'react';
import { AuthLayout } from '../auth/AuthLayout';
import { RegisterForm } from '../auth/RegisterForm';

export const RegisterPage = () => {
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start your journey with us today."
      heroSlideIndex={2}
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
