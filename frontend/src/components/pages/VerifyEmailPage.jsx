import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from '../auth/AuthLayout';
import { VerifyEmailForm } from '../auth/VerifyEmailForm';

export const VerifyEmailPage = () => {
  const { unverifiedEmail } = useAuth();

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        <>
          A verification code has been sent to{' '}
          <strong style={{ color: '#111827', fontWeight: 600 }}>
            {unverifiedEmail || 'your email'}
          </strong>
          . Please enter the code below to continue
        </>
      }
      heroSlideIndex={1}
    >
      <VerifyEmailForm />
    </AuthLayout>
  );
};

export default VerifyEmailPage;
