import { ref, computed, onMounted, onUnmounted } from 'vue';
import { pb } from '../services/pocketbase';
import type { RecordModel } from 'pocketbase';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export function useAuth() {
  const user = ref<AuthUser | null>(null);
  const loading = ref(true);

  // Extract user info from PocketBase auth record
  const extractUser = (record: RecordModel | null): AuthUser | null => {
    if (!record) return null;
    return {
      id: record.id,
      email: record.email || '',
      name: record.name || record.email || 'User',
      avatar: record.avatar 
        ? pb.files.getURL(record, record.avatar)
        : ''
    };
  };

  const isAuthenticated = computed(() => !!user.value);

  // Silent refresh - try to refresh token if expired
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

  const loginWithGoogle = async () => {
    try {
      loading.value = true;
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const logout = () => {
    pb.authStore.clear();
    user.value = null;
  };

  let unsubscribe: (() => void) | null = null;
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    // Initial auth check
    if (pb.authStore.isValid && pb.authStore.record) {
      user.value = extractUser(pb.authStore.record);
    }
    loading.value = false;

    // Listen for auth state changes
    unsubscribe = pb.authStore.onChange((_token, record) => {
      user.value = extractUser(record);
    });

    // Refresh token on mount and every 10 minutes
    refreshAuth();
    refreshInterval = setInterval(refreshAuth, 10 * 60 * 1000);
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  return {
    user,
    loading,
    isAuthenticated,
    loginWithGoogle,
    logout
  };
}
