<script setup lang="ts">
import { computed } from 'vue';

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
  
  // Logic for haptic-like feedback can be added here
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
};
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-[60] bg-white/80 dark:bg-[#111722]/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-safe sm:hidden">
    <div class="flex items-center justify-around h-16 px-4">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="handleTabClick(tab.key)"
        class="relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 group"
        :class="activeTab === tab.key ? 'text-primary' : 'text-slate-500 dark:text-slate-400'"
      >
        <!-- Indicator Dot above active tab -->
        <span 
          class="absolute top-0 w-8 h-1 rounded-full bg-primary transition-all duration-300 -translate-y-px"
          :class="activeTab === tab.key ? 'opacity-100 scale-100' : 'opacity-0 scale-50'"
        ></span>

        <div class="relative">
          <span 
            class="material-symbols-outlined text-[24px] transition-transform duration-300 group-active:scale-90"
            :class="activeTab === tab.key ? 'fill-[1]' : ''"
          >
            {{ tab.icon }}
          </span>
          
          <!-- Badge -->
          <span
            v-if="tab.count !== undefined && tab.count > 0"
            class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full ring-2 ring-white dark:ring-[#111722]"
          >
            {{ tab.count > 99 ? '99+' : tab.count }}
          </span>
        </div>

        <span class="text-[10px] font-bold uppercase tracking-wider">
          {{ tab.label }}
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Material Symbols fill control */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.fill-\[1\] {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
