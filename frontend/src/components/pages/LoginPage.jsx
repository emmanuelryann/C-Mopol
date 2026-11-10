import React from 'react';
import { AuthLayout } from '../auth/AuthLayout';
import { LoginForm } from '../auth/LoginForm';

export const LoginPage = () => {
  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Sign in to continue where you left off."
      heroSlideIndex={0}
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
