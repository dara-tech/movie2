import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Film, Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset token. Please request a new password reset link.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!token) {
      setError('Invalid reset token. Please request a new password reset link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/auth/reset-password', { 
        token, 
        password 
      });
      setSuccess(true);
      toast.success(response.data.message || 'Password reset successfully!');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to reset password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Card className="bg-black border border-gray-800 rounded-none">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-green-600/20 border border-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-white">Password Reset Successful</CardTitle>
              <CardDescription className="text-gray-400 text-lg">
                Your password has been reset successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-none border border-green-900/50 text-green-400 text-sm bg-green-950/30">
                <p>You can now login with your new password. Redirecting to login page...</p>
              </div>
              
              <Button
                onClick={() => navigate('/login')}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base uppercase tracking-wider rounded-none"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 bg-red-600 border border-gray-700 flex items-center justify-center">
              <Film className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white uppercase tracking-wider">
              MovieStream
            </h1>
          </div>
        </div>

        <Card className="bg-black border border-gray-800 rounded-none">
          <CardHeader className="space-y-1 text-center pb-6">
            <CardTitle className="text-3xl font-bold text-white">Reset Password</CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-none border border-red-900/50 text-red-400 text-sm bg-red-950/30">
                {error}
              </div>
            )}
            
            {!token && (
              <div className="p-4 rounded-none border border-yellow-900/50 text-yellow-400 text-sm bg-yellow-950/30">
                <p className="mb-2">Invalid or missing reset token.</p>
                <Link 
                  to="/forgot-password" 
                  className="text-yellow-300 hover:text-yellow-200 underline"
                >
                  Request a new password reset link
                </Link>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="password" className="text-gray-300 font-bold text-sm uppercase tracking-wide">
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !token}
                  required
                  minLength={6}
                  className="bg-gray-950 border border-gray-800 text-white placeholder-gray-600 h-12 text-base rounded-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all duration-200"
                />
                <p className="text-xs text-gray-500">Must be at least 6 characters long</p>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-gray-300 font-bold text-sm uppercase tracking-wide">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || !token}
                  required
                  minLength={6}
                  className="bg-gray-950 border border-gray-800 text-white placeholder-gray-600 h-12 text-base rounded-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all duration-200"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base uppercase tracking-wider rounded-none transition-all duration-200" 
                disabled={loading || !token}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Resetting...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Reset Password
                  </div>
                )}
              </Button>
              
              <div className="text-center text-sm pt-4">
                <Link 
                  to="/login" 
                  className="text-red-400 hover:text-red-300 font-medium transition-colors duration-200 inline-flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 MovieStream. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;


