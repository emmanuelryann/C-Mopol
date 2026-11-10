import React from 'react';
import { AuthLayout } from '../auth/AuthLayout';
import { ResetPasswordForm } from '../auth/ResetPasswordForm';

export const ResetPasswordPage = (props) => {
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter and confirm your new secure password."
      heroSlideIndex={3}
    >
      <ResetPasswordForm token={props?.token} />
    </AuthLayout>
  );
};

export default ResetPasswordPage;
