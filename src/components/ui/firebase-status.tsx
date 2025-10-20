'use client';

import React from 'react';
import { useFirebase } from '@/firebase/provider';
import { isUsingDemoConfig } from '@/firebase/config';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function FirebaseStatus() {
  const { user, isUserLoading, userError } = useFirebase();

  if (isUsingDemoConfig) {
    return (
      <Badge variant="outline" className="gap-2">
        <AlertCircle className="h-3 w-3 text-yellow-500" />
        Demo Mode
      </Badge>
    );
  }

  if (isUserLoading) {
    return (
      <Badge variant="outline" className="gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Connecting...
      </Badge>
    );
  }

  if (userError) {
    return (
      <Badge variant="destructive" className="gap-2">
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-2">
      <CheckCircle className="h-3 w-3 text-green-500" />
      {user ? 'Authenticated' : 'Ready'}
    </Badge>
  );
}

export function FirebaseProjectInfo() {
  return (
    <div className="text-xs text-muted-foreground">
      Firebase Project: studio-7522026757-cda8b
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-1">
          Environment: Development
        </div>
      )}
    </div>
  );
}