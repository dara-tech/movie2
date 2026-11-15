import React, { useEffect, useRef } from 'react';
import api from '../services/api';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAuthButtonProps {
  onSuccess: (idToken: string) => Promise<void> | void;
  onError: (message: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCRIPT_ID = 'google-identity-services-script';

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onSuccess, onError, disabled = false }) => {
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let loadHandler: (() => void) | null = null;

    const loadGoogleClientId = async () => {
      if (process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        return process.env.REACT_APP_GOOGLE_CLIENT_ID;
      }

      const response = await api.get('/api/auth/google-config', {
        headers: { 'X-No-Cache': 'true' }
      });
      return response.data?.clientId as string;
    };

    const setupGoogleButton = (clientId: string) => {
      if (!window.google?.accounts?.id || initializedRef.current || !buttonContainerRef.current || !isMounted) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          if (!response?.credential) {
            onError('Google login failed. No token received.');
            return;
          }
          await onSuccess(response.credential);
        }
      });

      buttonContainerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 400,
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left'
      });
      initializedRef.current = true;
    };

    const initialize = async () => {
      try {
        const clientId = await loadGoogleClientId();
        if (!clientId) {
          onError('Google login is not configured.');
          return;
        }

        const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
          if (window.google?.accounts?.id) {
            setupGoogleButton(clientId);
          } else {
            loadHandler = () => setupGoogleButton(clientId);
            existingScript.addEventListener('load', loadHandler, { once: true });
          }
          return;
        }

        const script = document.createElement('script');
        script.id = GOOGLE_SCRIPT_ID;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setupGoogleButton(clientId);
        script.onerror = () => onError('Failed to load Google login. Please try again.');
        document.head.appendChild(script);
      } catch (error: any) {
        const message = error?.response?.data?.error || 'Google login is not configured.';
        onError(message);
      }
    };

    initialize();
    return () => {
      isMounted = false;
      if (loadHandler) {
        const script = document.getElementById(GOOGLE_SCRIPT_ID);
        script?.removeEventListener('load', loadHandler);
      }
    };
  }, [onError, onSuccess]);

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div ref={buttonContainerRef} />
    </div>
  );
};

export default GoogleAuthButton;
