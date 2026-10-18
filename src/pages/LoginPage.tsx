// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api';
import { SignUpPage } from './SignUpPage';

interface LoginPageProps {
  onLoginSuccess: (token: string, refreshToken: string, user: any) => void;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function LoginPage({ onLoginSuccess, showToast }: LoginPageProps) {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.auth.login({
        emailOrPhone,
        password,
      });

      if (response && response.token) {
        localStorage.setItem('accessToken', response.token);
        localStorage.setItem('refreshToken', response.refreshToken);
        localStorage.setItem('user', JSON.stringify(response));

        api.setTokens(response.token, response.refreshToken);

        onLoginSuccess(response.token, response.refreshToken, response);
        showToast('success', 'Login successful! Welcome back.');
      } else {
        setError('Invalid response from server');
        showToast('error', 'Login failed: Invalid response');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'Something went wrong. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsResetting(true);

    try {
      await api.auth.forgotPassword({ email: resetEmail });
      setResetStep('verify');
      showToast('success', 'OTP sent to your email!');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to send OTP';
      setError(message);
      showToast('error', message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsResetting(true);

    try {
      await api.auth.resetPassword({
        email: resetEmail,
        otpCode,
        newPassword,
      });

      showToast('success', 'Password reset successful! Please login.');
      setShowForgotPassword(false);
      setResetStep('request');
      setResetEmail('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to reset password';
      setError(message);
      showToast('error', message);
    } finally {
      setIsResetting(false);
    }
  };

  // If Sign Up is shown
  if (showSignUp) {
    return (
      <SignUpPage
        onSignUpSuccess={onLoginSuccess}
        showToast={showToast}
        onBackToLogin={() => setShowSignUp(false)}
      />
    );
  }

  // If forgot password is shown
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              {resetStep === 'request' ? 'Forgot Password' : 'Reset Password'}
            </h2>
            <p className="text-gray-600 mt-2">
              {resetStep === 'request'
                ? 'Enter your email to receive an OTP'
                : 'Enter OTP and new password'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetStep === 'request' ? (
            <form onSubmit={handleForgotPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetStep('request');
                  setError('');
                }}
                className="w-full mt-3 text-sm text-gray-600 hover:text-gray-900"
              >
                Back to Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OTP Code
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter 6-digit OTP"
                  required
                  maxLength={6}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetStep('request');
                  setError('');
                }}
                className="w-full mt-3 text-sm text-gray-600 hover:text-gray-900"
              >
                Back to OTP Request
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Login Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="PlateMate logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain shadow-sm" />
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email or Phone Number
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter email or phone"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="rounded border-gray-300" />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => setShowSignUp(true)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}