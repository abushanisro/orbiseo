'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Recaptcha, RecaptchaRef } from '@/components/ui/recaptcha';
import { useToast } from '@/hooks/use-toast';

interface SearchFormProps {
  onSearch: (query: string, recaptchaToken: string | null) => Promise<void>;
  placeholder?: string;
  className?: string;
}

export function SearchFormWithRecaptcha({
  onSearch,
  placeholder = "Enter your search query...",
  className = ""
}: SearchFormProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const recaptchaRef = useRef<RecaptchaRef>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a search query",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Execute reCAPTCHA
      let recaptchaToken: string | null = null;
      if (recaptchaRef.current?.isReady) {
        recaptchaToken = await recaptchaRef.current.executeRecaptcha('search');
        if (!recaptchaToken) {
          toast({
            title: "Security verification failed",
            description: "Please try again",
            variant: "destructive"
          });
          return;
        }
      }

      // Perform search
      await onSearch(query, recaptchaToken);

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecaptchaError = (error: string) => {
    console.error('reCAPTCHA error:', error);
    toast({
      title: "Security verification error",
      description: "reCAPTCHA failed to load. You can still search, but requests may be rate-limited.",
      variant: "destructive"
    });
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {/* reCAPTCHA component - invisible */}
      <Recaptcha
        ref={recaptchaRef}
        onError={handleRecaptchaError}
        onReady={() => console.log('🛡️ reCAPTCHA ready for OrbiSEO search')}
      />
    </div>
  );
}