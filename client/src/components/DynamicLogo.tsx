import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Film } from 'lucide-react';

interface DynamicLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const DynamicLogo: React.FC<DynamicLogoProps> = ({ 
  className = '', 
  size = 'md',
  showTagline = false 
}) => {
  const [logoData, setLogoData] = useState<{
    logoUrl: string | null; 
    type: string; 
    text: string;
    textFirst?: string;
    textSecond?: string;
    addSpace?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await api.get('/api/site-settings/logo');
        if (response.data.success) {
          setLogoData(response.data.data);
        }
      } catch (error) {
        // Silently fail and use default text logo
        setLogoData({ logoUrl: null, type: 'text', text: 'MOVIESTREAM', textFirst: 'MOVIE', textSecond: 'STREAM', addSpace: false });
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="w-14 h-14 bg-red-600 border border-gray-700 flex items-center justify-center animate-pulse">
          <Film className="w-8 h-8 text-white" />
        </div>
      </div>
    );
  }

  // Use new fields if available, otherwise fall back to parsing text
  let firstPart = 'MOVIE';
  let secondPart = '';
  
  if (logoData?.textFirst !== undefined || logoData?.textSecond !== undefined) {
    firstPart = logoData.textFirst || 'MOVIE';
    secondPart = logoData.textSecond || '';
  } else {
    // Fallback: parse from combined text
    const textParts = (logoData?.text || 'MOVIESTREAM').split(' ');
    firstPart = textParts[0] || 'MOVIE';
    secondPart = textParts.slice(1).join(' ') || '';
  }
  
  const space = logoData?.addSpace ? ' ' : '';

  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  return (
    <div className={`text-center ${className}`}>
      {logoData?.logoUrl && logoData.type !== 'text' ? (
        <div className="flex flex-col items-center">
          <img 
            src={logoData.logoUrl.startsWith('http') 
              ? logoData.logoUrl 
              : `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}${logoData.logoUrl}`
            }
            alt="Logo"
            className={`${size === 'sm' ? 'h-8' : size === 'md' ? 'h-12' : 'h-16'} max-w-[250px] object-contain`}
            onError={() => {
              // Fallback to text logo if image fails to load
              setLogoData({ logoUrl: null, type: 'text', text: logoData.text || 'MOVIESTREAM' });
            }}
          />
          {showTagline && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-1 h-1 bg-red-600"></div>
              <p className="text-gray-500 text-xs uppercase tracking-widest">Your Gateway to Entertainment</p>
              <div className="w-1 h-1 bg-red-600"></div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className={`flex items-center gap-3 mb-4`}>
            <div className={`${size === 'sm' ? 'w-10 h-10' : size === 'md' ? 'w-14 h-14' : 'w-16 h-16'} bg-red-600 border border-gray-700 flex items-center justify-center`}>
              <Film className={`${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'} text-white`} />
            </div>
            <h1 className={`${sizeClasses[size]} font-bold text-white uppercase tracking-wider`}>
              {firstPart}{secondPart && <span className="text-red-600">{space}{secondPart}</span>}
            </h1>
          </div>
          {showTagline && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-1 h-1 bg-red-600"></div>
              <p className="text-gray-500 text-xs uppercase tracking-widest">Your Gateway to Entertainment</p>
              <div className="w-1 h-1 bg-red-600"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DynamicLogo;

