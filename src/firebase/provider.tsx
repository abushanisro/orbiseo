'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { auth, firestore, firebaseApp } from '@/firebase';
import { isUsingDemoConfig } from '@/firebase/config';

interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    // Skip Firebase auth if using demo config
    if (isUsingDemoConfig) {
      console.warn('OrbiSEO: Using demo Firebase config. Please configure your Firebase API keys in .env.local');
      setIsUserLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setIsUserLoading(false);
      },
      (error) => {
        console.error('Firebase auth error:', error);
        setUserError(error);
        setIsUserLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({
    firebaseApp,
    firestore,
    auth,
    user,
    isUserLoading,
    userError,
  }), [user, isUserLoading, userError]);

  return (
    <FirebaseContext.Provider value={value}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
}

export function useAuth(): Auth {
    const context = useFirebase();
    if (!context.auth) {
      throw new Error('Auth not initialized. Make sure you are within a FirebaseProvider.');
    }
    return context.auth;
}

export function useFirestore(): Firestore {
    const context = useFirebase();
    if (!context.firestore) {
      throw new Error('Firestore not initialized. Make sure you are within a FirebaseProvider.');
    }
    return context.firestore;
}

export function useFirebaseApp(): FirebaseApp {
    const context = useFirebase();
    if (!context.firebaseApp) {
      throw new Error('Firebase App not initialized. Make sure you are within a FirebaseProvider.');
    }
    return context.firebaseApp;
}

export function useUser() {
  const { user, isUserLoading, userError } = useFirebase();
  return { user, isUserLoading, userError };
}

export type WithId<T> = T & { id: string };
