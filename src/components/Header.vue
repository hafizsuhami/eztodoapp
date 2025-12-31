<script setup lang="ts">
import type { AuthUser } from '../composables/useAuth';
import type { SyncStatus } from '../composables/useTasks';
import SyncIndicator from './SyncIndicator.vue';

import { useTheme } from '../composables/useTheme';

const props = defineProps<{
  user?: AuthUser | null;
  syncStatus?: SyncStatus;
}>();

const emit = defineEmits<{
  logout: [];
}>();

const { isDark, activeTheme, setTheme, toggleTheme } = useTheme(
  () => props.user?.id,
  () => props.user?.theme
);

const themes = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'dim', label: 'Dim' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'vibrantPurple', label: 'Vibrant Purple' },
  { key: 'blush', label: 'Blush' },
  { key: 'playful', label: 'Playful Kids' }
];
</script>

<template>
  <header class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-[#232f48] px-4 md:px-10 py-3 bg-white dark:bg-[#111722] sticky top-0 z-50">
    <div class="flex items-center gap-4 text-slate-900 dark:text-white">
      <div class="size-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
        <span class="material-symbols-outlined">check_circle</span>
      </div>
      <h2 class="text-lg font-bold leading-tight tracking-[-0.015em]">EZtodo</h2>
    </div>
    <div class="flex flex-1 justify-end items-center gap-4">
      <!-- Sync Status Indicator -->
      <SyncIndicator :status="syncStatus || 'synced'" />

      <!-- Theme Toggle -->
      <div class="relative group">
        <button 
          class="flex items-center justify-center size-9 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Switch theme"
        >
          <span class="material-symbols-outlined text-[20px]">
            palette
          </span>
        </button>
        <div class="absolute right-0 mt-2 w-40 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div class="py-2 flex flex-col">
            <button
              v-for="theme in themes"
              :key="theme.key"
              @click="setTheme(theme.key)"
              class="flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>{{ theme.label }}</span>
              <span v-if="activeTheme === theme.key" class="material-symbols-outlined text-[16px] text-primary">check</span>
            </button>
          </div>
        </div>
      </div>

      <!-- User Profile -->
      <div v-if="user" class="flex items-center gap-3">
        <div class="hidden sm:flex flex-col items-end">
          <span class="text-sm font-medium text-slate-900 dark:text-white">
            {{ user.name }}
          </span>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {{ user.email }}
          </span>
        </div>
        
        <div class="relative group">
          <div 
            class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-slate-200 dark:ring-[#232f48] cursor-pointer" 
            :title="user.name"
            :style="{
              backgroundImage: user.avatar 
                ? `url('${user.avatar}')` 
                : 'url(https://picsum.photos/64/64)',
            }"
          >
          </div>
          
          <!-- Dropdown Menu -->
          <div class="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div class="p-3 border-b border-slate-100 dark:border-slate-700 sm:hidden">
              <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                {{ user.name }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                {{ user.email }}
              </p>
            </div>
            <button
              @click="emit('logout')"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
