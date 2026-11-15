import React from 'react';

interface IconProps {
  size?: number;
  active?: boolean;
  className?: string;
}

/**
 * Authentic Telegram Brand Icon
 */
export const TelegramBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <circle cx="12" cy="12" r="12" fill="#24A1DE" />
    <path
      d="M5.4 12.05l11.75-4.53c.54-.2.94.13.77.89l-2 9.42c-.15.67-.54.83-1.1.52l-3.05-2.25-1.47 1.42c-.16.16-.3.3-.62.3l.22-3.11 5.67-5.12c.25-.22-.05-.34-.39-.12L8.14 14.1l-3.02-.94c-.66-.2-.67-.65.14-.97l.14-.14z"
      fill="#ffffff"
    />
  </svg>
);

/**
 * Authentic Bluesky Butterfly Brand Icon
 */
export const BlueskyBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 568 501"
    fill="none"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <path
      d="M123.121 33.664C188.241 82.5529 258.281 181.68 284 234.873C309.719 181.68 379.759 82.5529 444.879 33.664C491.866 -1.61207 568 -28.864 568 57.9464C568 75.2974 558.125 198.814 552.348 219.789C532.185 292.984 445.698 312.983 371.189 300.323C499.785 322.378 528.423 397.773 464.919 462.651C344.417 585.766 295.688 387.892 284 340.59C272.312 387.892 223.583 585.766 103.081 462.651C39.5771 397.773 68.2147 322.378 196.811 300.323C122.302 312.983 35.8152 292.984 15.6518 219.789C9.87463 198.814 0 75.2974 0 57.9464C0 -28.864 76.1339 -1.61207 123.121 33.664Z"
      fill="#1185FE"
    />
  </svg>
);

/**
 * Authentic Tumblr Brand Icon
 */
export const TumblrBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <path
      d="M14.563 24c-5.093 0-7.031-2.544-7.031-6.916V10.74H4.512V6.993C7.424 5.961 8.948 3.513 9.176 0h4.298v6.18h4.521v4.56h-4.521v5.748c0 2.22.868 2.872 2.712 2.872h1.814V24h-3.437z"
      fill={active ? 'var(--sys-cyan)' : '#001935'}
    />
  </svg>
);

/**
 * Authentic Twitter / X Brand Icon
 */
export const TwitterBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/**
 * Authentic Reddit Brand Icon
 */
export const RedditBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <circle cx="12" cy="12" r="12" fill="#FF4500" />
    <path
      d="M19.1 12.05c0-.8-.65-1.45-1.45-1.45-.4 0-.75.16-1 .42-1.15-.8-2.73-1.32-4.48-1.38l.8-3.78 2.62.56c.03.62.54 1.12 1.18 1.12.66 0 1.2-.54 1.2-1.2 0-.66-.54-1.2-1.2-1.2-.46 0-.86.26-1.06.64l-2.92-.62a.3.3 0 00-.35.23l-.92 4.3c-1.8.05-3.41.57-4.58 1.38-.26-.26-.61-.42-1.01-.42-.8 0-1.45.65-1.45 1.45 0 .56.32 1.05.78 1.29-.02.17-.03.35-.03.53 0 2.68 3.12 4.86 6.96 4.86s6.96-2.18 6.96-4.86c0-.18-.01-.36-.03-.53.46-.24.77-.73.77-1.29zm-10.25.96c0-.53.43-.96.96-.96.53 0 .96.43.96.96 0 .53-.43.96-.96.96-.53 0-.96-.43-.96-.96zm6.3 3.32c-.75.75-2.18.81-2.95.81s-2.2-.06-2.95-.81a.3.3 0 01.42-.42c.54.54 1.66.63 2.53.63.87 0 1.99-.09 2.53-.63a.3.3 0 01.42.42zm-.3-2.36c-.53 0-.96-.43-.96-.96 0-.53.43-.96.96-.96.53 0 .96.43.96.96 0 .53-.43.96-.96.96z"
      fill="#ffffff"
    />
  </svg>
);

/**
 * Authentic Pinterest Brand Icon
 */
export const PinterestBrandIcon: React.FC<IconProps> = ({ size = 16, active = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ flexShrink: 0, display: 'inline-block' }}
  >
    <circle cx="12" cy="12" r="12" fill="#E60023" />
    <path
      d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12c0 3.18 1.98 5.89 4.8 6.97-.07-.59-.13-1.49.03-2.13l1-4.24s-.26-.51-.26-1.27c0-1.19.69-2.08 1.55-2.08.73 0 1.08.55 1.08 1.21 0 .73-.47 1.83-.71 2.85-.2.85.43 1.54 1.27 1.54 1.52 0 2.69-1.6 2.69-3.92 0-2.05-1.47-3.48-3.58-3.48-2.44 0-3.87 1.83-3.87 3.72 0 .74.28 1.53.64 1.96.07.09.08.16.06.25l-.24.97c-.04.16-.13.19-.3.12-1.12-.52-1.82-2.15-1.82-3.46 0-2.82 2.05-5.41 5.91-5.41 3.1 0 5.51 2.21 5.51 5.17 0 3.08-1.94 5.56-4.64 5.56-.91 0-1.76-.47-2.05-1.03l-.56 2.13c-.2.78-.75 1.75-1.11 2.34.84.26 1.73.4 2.66.4 4.14 0 7.5-3.36 7.5-7.5S16.14 4.5 12 4.5z"
      fill="#ffffff"
    />
  </svg>
);
