<script setup lang="ts">
const props = defineProps<{
  activeTab: string;
  tabs: {
    key: string;
    label: string;
    icon: string;
    count?: number;
  }[];
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: string): void;
}>();

const handleTabClick = (key: string) => {
  emit('update:activeTab', key);
};
</script>

<template>
  <aside class="hidden sm:flex flex-col w-56 h-[calc(100vh-57px)] sticky top-[57px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
    <!-- Navigation -->
    <nav class="flex flex-col gap-1 p-3">
      <span class="px-3 py-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
        Navigation
      </span>

      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="handleTabClick(tab.key)"
        class="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
        :class="[
          activeTab === tab.key
            ? 'bg-primary/10 dark:bg-primary/20 text-primary'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
        ]"
      >
        <!-- Icon -->
        <span
          class="material-symbols-outlined text-[22px] transition-all duration-200"
          :class="activeTab === tab.key ? 'icon-filled' : ''"
        >
          {{ tab.icon }}
        </span>

        <!-- Label -->
        <span class="flex-1 text-sm font-medium text-left">
          {{ tab.label }}
        </span>

        <!-- Count badge -->
        <span
          v-if="tab.count !== undefined && tab.count > 0"
          class="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-semibold rounded-full"
          :class="[
            activeTab === tab.key
              ? 'bg-primary/20 text-primary'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          ]"
        >
          {{ tab.count > 99 ? '99+' : tab.count }}
        </span>
      </button>
    </nav>

    <!-- Bottom section -->
    <div class="mt-auto p-3 border-t border-slate-200 dark:border-slate-800">
      <div class="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
        <p>Tip: Press <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono">n</kbd> to add a new task</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* Material Symbols - default outlined style */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

/* Filled icon style for active state */
.icon-filled {
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}
</style>
