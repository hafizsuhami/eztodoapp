<script setup lang="ts">
import { useHaptics } from '../composables/useHaptics';

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

const { haptic } = useHaptics();

const handleTabClick = (key: string) => {
  if (key !== props.activeTab) {
    haptic.selection();
  }
  emit('update:activeTab', key);
};
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 sm:hidden safe-bottom">
    <div class="flex items-center justify-around h-16 px-2">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="handleTabClick(tab.key)"
        class="relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 rounded-xl
          transition-all duration-200 group"
        :class="[
          activeTab === tab.key
            ? 'text-primary'
            : 'text-slate-400 dark:text-slate-500 active:bg-slate-100 dark:active:bg-slate-800/50'
        ]"
      >
        <!-- Active indicator pill -->
        <div
          v-if="activeTab === tab.key"
          class="absolute top-1.5 w-16 h-8 rounded-full bg-primary/10 dark:bg-primary/20"
        />

        <!-- Icon container -->
        <div class="relative z-10 flex items-center justify-center h-8">
          <span
            class="material-symbols-outlined text-[24px] transition-transform duration-200"
            :class="[
              activeTab === tab.key ? 'scale-105 icon-filled' : 'group-active:scale-90'
            ]"
          >
            {{ tab.icon }}
          </span>

          <!-- Badge -->
          <span
            v-if="tab.count !== undefined && tab.count > 0"
            class="absolute -top-0.5 -right-3 min-w-[18px] h-[18px] flex items-center justify-center
              bg-red-500 text-white text-[10px] font-bold rounded-full
              ring-2 ring-white dark:ring-slate-900"
          >
            {{ tab.count > 99 ? '99+' : tab.count }}
          </span>
        </div>

        <!-- Label -->
        <span
          class="relative z-10 text-[11px] font-medium leading-tight"
          :class="activeTab === tab.key ? 'font-semibold' : 'opacity-70'"
        >
          {{ tab.label }}
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Material Symbols - default outlined style */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}

/* Filled icon style for active state */
.icon-filled {
  font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
}
</style>
