import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Film, Mail, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
      toast.success(response.data.message || 'Password reset email sent!');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to send password reset email';
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
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-white">Check Your Email</CardTitle>
              <CardDescription className="text-gray-400 text-lg">
                We've sent a password reset link to your email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-none border border-green-900/50 text-green-400 text-sm bg-green-950/30">
                <p className="mb-2">If an account with that email exists, a password reset link has been sent.</p>
                <p className="text-xs text-gray-500">Please check your inbox and spam folder. The link will expire in 1 hour.</p>
              </div>
              
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-base uppercase tracking-wider rounded-none"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
                
                <div className="text-center text-sm pt-4">
                  <span className="text-gray-400">Didn't receive the email? </span>
                  <button
                    onClick={() => setSuccess(false)}
                    className="text-red-400 hover:text-red-300 font-medium transition-colors duration-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
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
            <CardTitle className="text-3xl font-bold text-white">Forgot Password</CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Enter your email to receive a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 rounded-none border border-red-900/50 text-red-400 text-sm bg-red-950/30">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-gray-300 font-bold text-sm uppercase tracking-wide">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="bg-gray-950 border border-gray-800 text-white placeholder-gray-600 h-12 text-base rounded-none focus:ring-1 focus:ring-red-600 focus:border-red-600 transition-all duration-200"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-base uppercase tracking-wider rounded-none transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Send Reset Link
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

export default ForgotPassword;


