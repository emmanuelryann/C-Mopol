import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState(() => {
    try {
      return (typeof window !== 'undefined' && localStorage.getItem('c_mopol_unverified_email')) || 'Mutiara@gmail.com';
    } catch {
      return 'Mutiara@gmail.com';
    }
  });

  const saveUnverifiedEmail = (email) => {
    setUnverifiedEmail(email);
    try {
      if (typeof window !== 'undefined') {
        if (email) {
          localStorage.setItem('c_mopol_unverified_email', email);
        } else {
          localStorage.removeItem('c_mopol_unverified_email');
        }
      }
    } catch {
      // Ignore storage errors
    }
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const data = await authService.getProfile();
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const markEmailVerified = () => {
    if (user) {
      setUser((prev) => ({ ...prev, isEmailVerified: true }));
    }
  };

  const value = {
    user,
    setUser,
    isLoading,
    isAuthenticated: Boolean(user),
    unverifiedEmail,
    setUnverifiedEmail: saveUnverifiedEmail,
    login,
    logout,
    checkAuth,
    markEmailVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
