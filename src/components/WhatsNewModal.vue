<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { supabase } from '../services/supabase';
import { getNewEntries, getLatestVersion, type ChangelogEntry } from '../lib/changelog';

const props = defineProps<{
  userId: string | null;
  lastSeenVersion: string | null;
}>();

const emit = defineEmits<{
  dismissed: [version: string];
}>();

const isOpen = ref(false);
const entries = ref<ChangelogEntry[]>([]);
const currentIndex = ref(0);

// Check if we should show the modal
const checkForUpdates = () => {
  if (!props.userId) return;

  const newEntries = getNewEntries(props.lastSeenVersion);
  if (newEntries.length > 0) {
    entries.value = newEntries;
    currentIndex.value = 0;
    isOpen.value = true;
  }
};

// Watch for user login
watch(() => props.userId, (newId) => {
  if (newId) {
    // Small delay to let the app settle
    setTimeout(checkForUpdates, 500);
  }
}, { immediate: true });

const currentEntry = () => entries.value[currentIndex.value];

const handleNext = () => {
  if (currentIndex.value < entries.value.length - 1) {
    currentIndex.value++;
  } else {
    handleDismiss();
  }
};

const handleDismiss = async () => {
  isOpen.value = false;
  const latestVersion = getLatestVersion();

  // Save to Supabase user metadata
  if (props.userId) {
    try {
      await supabase.auth.updateUser({
        data: { last_seen_changelog: latestVersion }
      });
    } catch (error) {
      console.error('Failed to save changelog preference:', error);
    }
  }

  // Also save to localStorage as fallback
  localStorage.setItem('last_seen_changelog', latestVersion);

  emit('dismissed', latestVersion);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen && entries.length > 0"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        @click.self="handleDismiss"
      >
        <Transition
          enter-active-class="transition-all duration-300"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            <!-- Header with gradient -->
            <div class="relative bg-gradient-to-br from-primary via-primary to-purple-600 px-6 py-8 text-white">
              <!-- Decorative circles -->
              <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>

              <div class="relative">
                <div class="flex items-center gap-2 text-white/80 text-sm font-medium mb-2">
                  <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
                  What's New
                </div>
                <h2 class="text-2xl font-bold">{{ currentEntry()?.title }}</h2>
                <p class="text-white/70 text-sm mt-1">Version {{ currentEntry()?.version }}</p>
              </div>
            </div>

            <!-- Features list -->
            <div class="px-6 py-5 max-h-[50vh] overflow-y-auto">
              <div class="space-y-4">
                <div
                  v-for="(feature, index) in currentEntry()?.features"
                  :key="index"
                  class="flex gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div class="shrink-0 size-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-[22px]">{{ feature.icon }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-slate-900 dark:text-white text-sm">{{ feature.title }}</h3>
                    <p class="text-slate-600 dark:text-slate-400 text-sm mt-0.5 leading-relaxed">{{ feature.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <!-- Page indicator (if multiple entries) -->
              <div class="flex items-center gap-1.5">
                <template v-if="entries.length > 1">
                  <span
                    v-for="(_, i) in entries"
                    :key="i"
                    :class="[
                      'size-2 rounded-full transition-colors',
                      i === currentIndex ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                    ]"
                  ></span>
                </template>
              </div>

              <div class="flex items-center gap-3">
                <button
                  @click="handleDismiss"
                  class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Skip
                </button>
                <button
                  @click="handleNext"
                  class="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  {{ currentIndex < entries.length - 1 ? 'Next' : 'Got it!' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
