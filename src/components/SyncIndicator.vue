<script setup lang="ts">
import type { SyncStatus } from '../composables/useTasks';

defineProps<{
  status: SyncStatus;
}>();

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
</template>
