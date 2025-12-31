<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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

const isThemeOpen = ref(false);
const isProfileOpen = ref(false);
const themeMenuRef = ref<HTMLDivElement | null>(null);
const profileMenuRef = ref<HTMLDivElement | null>(null);

const themes = [
  { key: 'light', label: 'Light', icon: 'light_mode' },
  { key: 'dark', label: 'Dark', icon: 'dark_mode' },
  { key: 'dim', label: 'Dim', icon: 'brightness_medium' },
  { key: 'sepia', label: 'Sepia', icon: 'filter_vintage' },
  { key: 'vibrantPurple', label: 'Vibrant Purple', icon: 'palette' },
  { key: 'blush', label: 'Blush', icon: 'favorite' },
  { key: 'playful', label: 'Playful Kids', icon: 'toys' }
];

const handleClickOutside = (event: MouseEvent) => {
  if (themeMenuRef.value && !themeMenuRef.value.contains(event.target as Node)) {
    isThemeOpen.value = false;
  }
  if (profileMenuRef.value && !profileMenuRef.value.contains(event.target as Node)) {
    isProfileOpen.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isThemeOpen.value = false;
    isProfileOpen.value = false;
  }
};

const handleThemeSelect = (themeKey: string) => {
  setTheme(themeKey);
  isThemeOpen.value = false;
};

const handleThemeKeydown = (event: KeyboardEvent, themeKey: string) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleThemeSelect(themeKey);
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <header class="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-[#232f48] px-4 md:px-10 py-3 bg-white dark:bg-[#111722] sticky top-0 z-50">
    <div class="flex items-center gap-4 text-slate-900 dark:text-white">
      <div class="size-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
        <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
      </div>
      <h2 class="text-lg font-bold leading-tight tracking-[-0.015em]">EZtodo</h2>
    </div>
    <div class="flex flex-1 justify-end items-center gap-4">
      <!-- Sync Status Indicator -->
      <SyncIndicator :status="syncStatus || 'synced'" />

      <!-- Theme Toggle -->
      <div class="relative" ref="themeMenuRef">
        <button 
          @click="isThemeOpen = !isThemeOpen"
          :aria-expanded="isThemeOpen"
          aria-haspopup="listbox"
          aria-label="Choose theme"
          class="flex items-center justify-center size-9 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
            palette
          </span>
        </button>
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div 
            v-if="isThemeOpen"
            role="listbox"
            aria-label="Theme options"
            class="absolute right-0 mt-2 w-44 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50"
          >
            <div class="py-2 flex flex-col">
              <button
                v-for="theme in themes"
                :key="theme.key"
                role="option"
                :aria-selected="activeTheme === theme.key"
                @click="handleThemeSelect(theme.key)"
                @keydown="handleThemeKeydown($event, theme.key)"
                class="flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 focus:outline-none"
              >
                <span class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ theme.icon }}</span>
                  {{ theme.label }}
                </span>
                <span v-if="activeTheme === theme.key" class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">check</span>
              </button>
            </div>
          </div>
        </Transition>
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
        
        <div class="relative" ref="profileMenuRef">
          <button
            @click="isProfileOpen = !isProfileOpen"
            :aria-expanded="isProfileOpen"
            aria-haspopup="menu"
            :aria-label="`User menu for ${user.name}`"
            class="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <div 
              class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-slate-200 dark:ring-[#232f48]" 
              :style="{
                backgroundImage: user.avatar 
                  ? `url('${user.avatar}')` 
                  : 'url(https://picsum.photos/64/64)',
              }"
              role="img"
              :aria-label="`${user.name}'s avatar`"
            >
            </div>
          </button>
          
          <!-- Dropdown Menu -->
          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition-all duration-100 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div 
              v-if="isProfileOpen"
              role="menu"
              class="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50"
            >
              <div class="p-3 border-b border-slate-100 dark:border-slate-700 sm:hidden">
                <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {{ user.name }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {{ user.email }}
                </p>
              </div>
              <button
                @click="emit('logout'); isProfileOpen = false"
                role="menuitem"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                Sign out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>
