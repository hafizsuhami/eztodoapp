<script setup lang="ts">
import { ref, watch } from 'vue';
import type { SyncStatus } from '../composables/useTasks';

const props = defineProps<{
  status: SyncStatus;
}>();

const showSyncedSuccess = ref(false);
let successTimeout: ReturnType<typeof setTimeout> | null = null;

// Watch for status changes to show success indicator
watch(() => props.status, (newStatus, oldStatus) => {
  // Show success checkmark when transitioning from syncing to synced
  if (oldStatus === 'syncing' && newStatus === 'synced') {
    showSyncedSuccess.value = true;
    
    // Clear any existing timeout
    if (successTimeout) {
      clearTimeout(successTimeout);
    }
    
    // Hide after 2 seconds
    successTimeout = setTimeout(() => {
      showSyncedSuccess.value = false;
    }, 2000);
  }
});

const config = {
  syncing: {
    icon: 'sync',
    text: 'Syncing...',
    className: 'text-blue-500 animate-spin'
  },
  offline: {
    icon: 'cloud_off',
    text: 'Offline',
    className: 'text-amber-500'
  },
  error: {
    icon: 'error',
    text: 'Sync error',
    className: 'text-red-500'
  },
  synced: {
    icon: '',
    text: '',
    className: ''
  }
};
</script>

<template>
  <!-- Active sync states (syncing, offline, error) -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-90"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-90"
  >
    <div
      v-if="status !== 'synced'"
      class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
    >
      <span
        class="material-symbols-outlined text-[16px]"
        :class="config[status].className"
      >
        {{ config[status].icon }}
      </span>
      <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
        {{ config[status].text }}
      </span>
    </div>
  </Transition>

  <!-- Success indicator (cloud with checkmark) -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-90"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-all duration-500 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-90"
  >
    <div
      v-if="status === 'synced' && showSyncedSuccess"
      class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30"
    >
      <span class="material-symbols-outlined text-[16px] text-emerald-500">
        cloud_done
      </span>
      <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        Saved
      </span>
    </div>
  </Transition>
</template>
