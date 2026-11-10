import React from 'react';
import { navigate } from '@reach/router';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from '../auth/AuthLayout';
import { VerifyEmailForm } from '../auth/VerifyEmailForm';

export const ProfileVerifyEmailPage = () => {
  const { user } = useAuth();

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        <>
          A verification code has been sent to{' '}
          <strong style={{ color: '#111827', fontWeight: 600 }}>
            {user?.email || 'your account email'}
          </strong>
          . Please enter the code below to continue
        </>
      }
      heroSlideIndex={1}
      backTo="/dashboard"
    >
      <VerifyEmailForm
        showUseAnotherAccount={false}
        onVerified={() => navigate('/dashboard')}
      />
    </AuthLayout>
  );
};

export default ProfileVerifyEmailPage;
