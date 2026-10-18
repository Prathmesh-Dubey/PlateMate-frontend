// src/pages/SignUpPage.tsx
import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, User, Phone } from 'lucide-react';
import api from '../api';

interface SignUpPageProps {
  onSignUpSuccess: (token: string, refreshToken: string, user: any) => void;
  showToast: (type: 'success' | 'error' | 'info', text: string) => void;
  onBackToLogin: () => void;
}

export function SignUpPage({ onSignUpSuccess, showToast, onBackToLogin }: SignUpPageProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP Verification State
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.auth.register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
      });

      setRegistrationEmail(formData.email);
      setShowOtpVerification(true);
      showToast('success', 'Registration successful! Please verify your email with OTP.');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsVerifying(true);

    try {
      const response = await api.auth.verifyOtp({
        email: registrationEmail,
        otpCode: otpCode,
        purpose: 'REGISTER',
      });

      // Store tokens
      localStorage.setItem('accessToken', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response));

      // Set token in api client
      api.setTokens(response.token, response.refreshToken);

      showToast('success', 'Email verified successfully!');
      onSignUpSuccess(response.token, response.refreshToken, response);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Invalid or expired OTP';
      setError(message);
      showToast('error', message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    try {
      await api.auth.resendOtp(registrationEmail, 'REGISTER');
      showToast('success', 'OTP resent successfully! Check your email.');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to resend OTP';
      showToast('error', message);
    } finally {
      setIsResending(false);
    }
  };

  // OTP Verification UI
  if (showOtpVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Verify Your Email</h2>
            <p className="text-gray-600 mt-2 text-sm">
              We've sent a 6-digit OTP to <br />
              <span className="font-semibold text-gray-900">{registrationEmail}</span>
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter OTP Code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="· · · · · ·"
                required
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Didn't receive the code?{' '}
              <button
                onClick={handleResendOtp}
                disabled={isResending}
                className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                    Resending...
                  </>
                ) : (
                  'Resend OTP'
                )}
              </button>
            </p>
            <button
              onClick={() => {
                setShowOtpVerification(false);
                setRegistrationEmail('');
                setOtpCode('');
                setError('');
                onBackToLogin();
              }}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sign Up Form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="PlateMate logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain shadow-sm" />
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600 mt-2">Join PlateMate today</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignUp}>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your full name"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Enter phone number"
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Create a password (min 6 chars)"
                required
                minLength={6}
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}