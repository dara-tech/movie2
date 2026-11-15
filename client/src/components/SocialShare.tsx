import React from 'react';
import { Share2, Facebook, Twitter, MessageCircle, Link2 } from 'lucide-react';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

/**
 * SocialShare component for sharing content on social media
 * Uses native Web Share API when available, falls back to manual share buttons
 */
export const SocialShare: React.FC<SocialShareProps> = ({
  url,
  title,
  description = '',
  image = '',
}) => {
  const fullUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${url}` 
    : url;
  
  const shareText = description ? `${title} - ${description.substring(0, 100)}` : title;

  // Native Web Share API (mobile)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: fullUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled');
      }
    } else {
      // Fallback: Copy to clipboard
      handleCopyLink();
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      // You can add a toast notification here
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Facebook share
  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };

  // Twitter/X share
  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${fullUrl}`)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-400 flex items-center gap-1">
        <Share2 className="w-4 h-4" />
        Share:
      </span>
      
      {/* Native Share (mobile) or Copy Link */}
      <button
        onClick={handleNativeShare}
        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        title="Share"
        aria-label="Share"
      >
        {navigator.share && typeof navigator.share === 'function' ? (
          <Share2 className="w-4 h-4 text-gray-300" />
        ) : (
          <Link2 className="w-4 h-4 text-gray-300" />
        )}
      </button>

      {/* Facebook */}
      <button
        onClick={handleFacebookShare}
        className="p-2 bg-gray-800 hover:bg-blue-600 rounded-lg transition-colors"
        title="Share on Facebook"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-4 h-4 text-gray-300" />
      </button>

      {/* Twitter/X */}
      <button
        onClick={handleTwitterShare}
        className="p-2 bg-gray-800 hover:bg-blue-400 rounded-lg transition-colors"
        title="Share on Twitter/X"
        aria-label="Share on Twitter/X"
      >
        <Twitter className="w-4 h-4 text-gray-300" />
      </button>

      {/* WhatsApp */}
      <button
        onClick={handleWhatsAppShare}
        className="p-2 bg-gray-800 hover:bg-green-600 rounded-lg transition-colors"
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-4 h-4 text-gray-300" />
      </button>
    </div>
  );
};


