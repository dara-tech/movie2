import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

interface TelegramJoinButtonProps {
  className?: string;
}

const TelegramJoinButton: React.FC<TelegramJoinButtonProps> = ({ className = '' }) => {
  const [telegramLink, setTelegramLink] = useState('https://t.me/moviestreamhdfree');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Check if user dismissed it this session
    const isDismissed = sessionStorage.getItem('telegram_banner_dismissed');
    if (isDismissed === 'true') {
      setIsVisible(false);
      return;
    }

    // Load dynamic telegram link from site settings if configured
    api.get('/api/site-settings')
      .then(res => {
        if (res.data?.success && res.data?.data?.telegram?.groupLink) {
          setTelegramLink(res.data.data.telegram.groupLink);
        }
      })
      .catch(() => {
        // Fallback to default channel link
      });
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    sessionStorage.setItem('telegram_banner_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 duration-500 ${className}`}
    >
      {/* Interactive Gradient Border Pill */}
      <div className="relative group rounded-full p-[1.5px] bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.35)] hover:shadow-[0_0_30px_rgba(14,165,233,0.6)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.98]">
        <div className="flex items-center gap-2 sm:gap-2.5 bg-black/90 hover:bg-black/80 backdrop-blur-xl rounded-full py-1.5 px-2.5 sm:py-2 sm:px-3.5 text-white select-none">
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer no-underline"
          >
            {/* Telegram Icon with Interactive Hover Tilt */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#0088cc] to-[#29b6f6] flex items-center justify-center shadow-md shadow-[#0088cc]/50 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 flex-shrink-0">
              <svg
                className="w-4 h-4 text-white fill-current translate-x-[-0.5px] translate-y-[0.5px]"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.93-1.28 4.88-2.12 5.86-2.54 2.79-1.16 3.37-1.36 3.75-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.01.19-.03.35z" />
              </svg>
            </div>

            {/* Only Join Telegram Label */}
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white group-hover:text-sky-300 transition-colors whitespace-nowrap px-1">
              Join Telegram
            </span>
          </a>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            type="button"
            aria-label="Dismiss Telegram button"
            className="p-1 -mr-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramJoinButton;
