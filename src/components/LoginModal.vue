<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  login: [];
}>();

const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
    emit('login');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center gap-6">
        <!-- Logo/Icon -->
        <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
          <span class="material-symbols-outlined text-primary text-4xl">task_alt</span>
        </div>

        <!-- Title -->
        <div class="text-center">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome to EZtodo
          </h1>
          <p class="text-slate-500 dark:text-slate-400 text-sm">
            Sign in to sync your tasks across all devices
          </p>
        </div>

        <!-- Google Sign In Button -->
        <button
          @click="handleLogin"
          :disabled="loading"
          class="w-full flex items-center justify-center gap-3 h-12 px-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <template v-if="loading">
            <span class="material-symbols-outlined animate-spin text-slate-500">progress_activity</span>
          </template>
          <template v-else>
            <!-- Google Icon -->
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span class="text-slate-700 dark:text-slate-200 font-medium">
              Continue with Google
            </span>
          </template>
        </button>

        <!-- Privacy Note -->
        <p class="text-xs text-slate-400 dark:text-slate-500 text-center">
          Your tasks are private and only visible to you
        </p>
      </div>
    </div>
  </Teleport>
</template>
