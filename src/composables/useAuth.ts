import { ref, computed, onMounted, onUnmounted } from 'vue';
import { supabase } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

export function useAuth() {
  const user = ref<AuthUser | null>(null);
  const loading = ref(true);

  // Extract user info from Supabase user
  const extractUser = (supabaseUser: User | null): AuthUser | null => {
    if (!supabaseUser) return null;
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email || 'User',
      avatar: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || ''
    };
  };

  const isAuthenticated = computed(() => !!user.value);

  const loginWithGoogle = async () => {
    try {
      loading.value = true;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google login failed:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    user.value = null;
  };

  let unsubscribe: { data: { subscription: { unsubscribe: () => void } } } | null = null;

  onMounted(async () => {
    // Initial auth check
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      user.value = extractUser(session.user);
    }
    loading.value = false;

    // Listen for auth state changes
    unsubscribe = supabase.auth.onAuthStateChange((_event, session) => {
      user.value = extractUser(session?.user ?? null);
    });
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe.data.subscription.unsubscribe();
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
