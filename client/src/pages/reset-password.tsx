import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import tspLogo from '@assets/LOGOS/TSP_transparent.png';
import { AuthPageLayout } from '@/components/layout/responsive-page-layout';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    hasLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
  });

  // Extract token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (!urlToken) {
      setMessage('Invalid reset link. Please request a new password reset.');
      setIsVerifyingToken(false);
      return;
    }

    setToken(urlToken);
    verifyToken(urlToken);
  }, []);

  // Check password strength
  useEffect(() => {
    setPasswordStrength({
      hasLength: newPassword.length >= 8,
      hasLowercase: /[a-z]/.test(newPassword),
      hasUppercase: /[A-Z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
    });
  }, [newPassword]);

  const verifyToken = async (resetToken: string) => {
    try {
      const response = await fetch(`/api/verify-reset-token/${resetToken}`);
      
      if (!response.ok) {
        // Handle 401 or other errors
        if (response.status === 401 || response.status === 400) {
          const data = await response.json().catch(() => ({}));
          setMessage(data.message || 'Invalid or expired reset token.');
        } else {
          setMessage('Unable to verify reset token. Please try again.');
        }
        return;
      }

      const data = await response.json();

      if (data.valid) {
        setTokenValid(true);
        setUserEmail(data.email);
      } else {
        setMessage(data.message || 'Invalid or expired reset token.');
      }
    } catch (error) {
      setMessage('Unable to verify reset token. Please try again.');
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      setIsSuccess(false);
      return;
    }

    const allStrengthRequirements =
      Object.values(passwordStrength).every(Boolean);
    if (!allStrengthRequirements) {
      setMessage('Password does not meet security requirements.');
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        setMessage(data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        setIsSuccess(false);
        setMessage(data.message);
      }
    } catch (error) {
      setIsSuccess(false);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifyingToken) {
    return (
      <AuthPageLayout title="Verifying..." showBack={false}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-teal-600" />
                <p className="text-slate-600">Verifying reset token...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  if (!tokenValid) {
    return (
      <AuthPageLayout title="Invalid Link" showBack>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <img
                src={tspLogo}
                alt="The Sandwich Project"
                className="h-12 sm:h-16 w-auto mx-auto mb-4"
              />
              <CardTitle className="text-red-600 text-xl sm:text-2xl">Invalid Reset Link</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 px-4 sm:px-6">
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{message}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button
                  onClick={() => (window.location.href = '/login')}
                  className="w-full bg-teal-600 hover:bg-teal-700 h-11"
                >
                  Back to Login
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/forgot-password')}
                  className="w-full h-11"
                >
                  Request New Reset Link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthPageLayout title="Success" showBack={false}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <img
                src={tspLogo}
                alt="The Sandwich Project"
                className="h-12 sm:h-16 w-auto mx-auto mb-4"
              />
              <CardTitle className="text-green-600 text-xl sm:text-2xl">
                Password Reset Successful
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 px-4 sm:px-6">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{message}</AlertDescription>
              </Alert>
              <p className="text-slate-600 text-xs sm:text-sm">
                You will be redirected to login in 3 seconds...
              </p>
              <Button
                onClick={() => (window.location.href = '/login')}
                className="w-full bg-teal-600 hover:bg-teal-700 h-11"
              >
                Go to Login Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title="Reset Password" showBack>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-12 sm:h-16 w-auto mx-auto mb-4"
            />
            <CardTitle className="text-xl sm:text-2xl">Reset Your Password</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Enter a new password for {userEmail}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-6">
              {message && (
                <Alert variant={isSuccess ? 'default' : 'destructive'}>
                  <AlertDescription className="text-sm">{message}</AlertDescription>
                </Alert>
              )}

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="h-11 text-base pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicators */}
              {newPassword && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">
                    Password Requirements:
                  </Label>
                  <div className="space-y-1">
                    {Object.entries({
                      hasLength: 'At least 8 characters',
                      hasLowercase: 'One lowercase letter',
                      hasUppercase: 'One uppercase letter',
                      hasNumber: 'One number',
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        {passwordStrength[
                          key as keyof typeof passwordStrength
                        ] ? (
                          <CheckCircle size={12} className="text-green-600" />
                        ) : (
                          <XCircle size={12} className="text-red-400" />
                        )}
                        <span
                          className={
                            passwordStrength[key as keyof typeof passwordStrength]
                              ? 'text-green-600'
                              : 'text-slate-500'
                          }
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="h-11 text-base pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-sm">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 h-11"
                disabled={
                  isLoading ||
                  !Object.values(passwordStrength).every(Boolean) ||
                  newPassword !== confirmPassword
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => (window.location.href = '/login')}
                  className="text-slate-600 hover:text-slate-800"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthPageLayout>
  );
}
