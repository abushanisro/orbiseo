'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import { useRecaptcha } from '@/hooks/use-recaptcha';

export interface RecaptchaRef {
  executeRecaptcha: (action: string) => Promise<string | null>;
  isReady: boolean;
}

interface RecaptchaProps {
  onError?: (error: string) => void;
  onReady?: () => void;
}

export const Recaptcha = forwardRef<RecaptchaRef, RecaptchaProps>(
  ({ onError, onReady }, ref) => {
    const { executeRecaptcha, isReady, error } = useRecaptcha();

    useImperativeHandle(ref, () => ({
      executeRecaptcha,
      isReady
    }));

    React.useEffect(() => {
      if (error && onError) {
        onError(error);
      }
    }, [error, onError]);

    React.useEffect(() => {
      if (isReady && onReady) {
        onReady();
      }
    }, [isReady, onReady]);

    return (
      <div className="recaptcha-container">
        {/* reCAPTCHA v3 is invisible, no UI needed */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground">
            🛡️ reCAPTCHA v3 {isReady ? 'Ready' : 'Loading...'}
            {error && <span className="text-red-500"> - Error: {error}</span>}
          </div>
        )}
      </div>
    );
  }
);

Recaptcha.displayName = 'Recaptcha';