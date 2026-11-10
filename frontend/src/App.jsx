import React from 'react';
import { Router } from '@reach/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';

// Authentication Pages
import { LoginPage } from './components/pages/LoginPage';
import { RegisterPage } from './components/pages/RegisterPage';
import { VerifyEmailPage } from './components/pages/VerifyEmailPage';
import { ForgotPasswordPage } from './components/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './components/pages/ResetPasswordPage';
import { SecurityPage } from './components/pages/SecurityPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { NotFoundPage } from './components/pages/NotFoundPage';

// Import CSS Styles from separate styles directory
import './styles/global.css';
import './styles/navbar.css';
import './styles/auth-layout.css';
import './styles/auth-forms.css';
import './styles/auth-hero.css';
import './styles/dashboard.css';
import './styles/security.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="app-root-shell">
          <Navbar />
          <div className="app-main-viewport">
            <Router className="router-outlet-container">
              <LoginPage path="/" />
              <LoginPage path="/login" />
              <RegisterPage path="/signup" />
              <RegisterPage path="/register" />
              <VerifyEmailPage path="/verify-email" />
              <ForgotPasswordPage path="/forgot-password" />
              <ResetPasswordPage path="/reset-password" />
              <ResetPasswordPage path="/reset-password/:token" />
              <SecurityPage path="/security" />
              <SecurityPage path="/sessions" />
              <DashboardPage path="/dashboard" />
              <NotFoundPage default />
            </Router>
          </div>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
