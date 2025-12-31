import { useState, useEffect, useCallback } from 'react';
import { pb } from '../services/pocketbase';
import { RecordModel } from 'pocketbase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Extract user info from PocketBase auth record
  const extractUser = useCallback((record: RecordModel | null): AuthUser | null => {
    if (!record) return null;
    return {
      id: record.id,
      email: record.email || '',
      name: record.name || record.email || 'User',
      avatar: record.avatar 
        ? pb.files.getURL(record, record.avatar)
        : ''
    };
  }, []);

  // Check auth state on mount and listen for changes
  useEffect(() => {
    // Initial auth check
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(extractUser(pb.authStore.record));
    }
    setLoading(false);

    // Listen for auth state changes
    const unsubscribe = pb.authStore.onChange((token, record) => {
      setUser(extractUser(record));
    });

    return () => {
      unsubscribe();
    };
  }, [extractUser]);

  // Silent refresh - try to refresh token if expired
  useEffect(() => {
    const refreshAuth = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
        } catch {
          // Token refresh failed, clear auth
          pb.authStore.clear();
        }
      }
    };

    refreshAuth();

    // Refresh token every 10 minutes
    const interval = setInterval(refreshAuth, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    loginWithGoogle,
    logout
  };
}
