import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { X, Star, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

/**
 * SignUpBanner - Promotional banner encouraging users to sign up for ad-free experience
 * Only shows to non-authenticated users
 */
const SignUpBanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if banner was previously dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('signup-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Don't show if user is authenticated or dismissed
  // Note: We show even while loading to avoid flash
  if (user || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('signup-banner-dismissed', 'true');
  };

  const handleSignUp = () => {
    navigate('/register');
  };

  return (
    <div className="fixed top-16 md:top-20 left-0 right-0 w-full bg-gradient-to-r from-red-600 via-red-700 to-red-600 border-b border-red-500 z-40 shadow-lg">
      <div className="container mx-auto px-3 py-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left side - Message */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">
                <span className="hidden sm:inline">Sign up for FREE and enjoy </span>
                <span className="text-yellow-300 font-bold">AD-FREE</span>
                <span className="hidden sm:inline"> streaming! 🎉</span>
                <span className="sm:hidden"> Sign up for <span className="text-yellow-300 font-bold">AD-FREE</span> streaming! 🎉</span>
              </p>
            </div>
          </div>

          {/* Right side - CTA Button and Dismiss */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleSignUp}
              className="bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold px-4 py-2 h-auto rounded transition-all duration-200 flex items-center gap-1 group shadow hover:shadow-md"
            >
              Sign Up Free
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-red-800/50 rounded transition-colors text-white hover:text-yellow-300"
              aria-label="Dismiss banner"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpBanner;

