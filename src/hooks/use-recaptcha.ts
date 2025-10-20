import { useCallback, useEffect, useState } from 'react';

// Declare global grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface UseRecaptchaReturn {
  executeRecaptcha: (action: string) => Promise<string | null>;
  isReady: boolean;
  error: string | null;
}

export function useRecaptcha(): UseRecaptchaReturn {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      setError('reCAPTCHA site key not configured');
      return;
    }

    // Check if grecaptcha is already loaded
    if (typeof window !== 'undefined' && window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsReady(true);
      });
    } else {
      // Wait for script to load
      const checkGrecaptcha = () => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(() => {
            setIsReady(true);
          });
        } else {
          setTimeout(checkGrecaptcha, 100);
        }
      };
      checkGrecaptcha();
    }
  }, [siteKey]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!siteKey) {
      setError('reCAPTCHA site key not configured');
      return null;
    }

    if (!isReady) {
      setError('reCAPTCHA not ready');
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(siteKey, { action });
      setError(null);
      return token;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'reCAPTCHA execution failed';
      setError(errorMessage);
      return null;
    }
  }, [siteKey, isReady]);

  return {
    executeRecaptcha,
    isReady,
    error
  };
}