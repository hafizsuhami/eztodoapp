<script setup lang="ts">
import { useToast, type Toast } from '../composables/useToast';

const { toasts, removeToast } = useToast();

const iconMap: Record<Toast['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

const styleMap: Record<Toast['type'], { 
  iconBg: string; 
  iconColor: string;
  gradient: string;
  shadow: string;
}> = {
  success: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500/5 to-transparent',
    shadow: 'shadow-emerald-500/10'
  },
  error: {
    iconBg: 'bg-red-100 dark:bg-red-500/20',
    iconColor: 'text-red-600 dark:text-red-400',
    gradient: 'from-red-500/5 to-transparent',
    shadow: 'shadow-red-500/10'
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500/5 to-transparent',
    shadow: 'shadow-amber-500/10'
  },
  info: {
    iconBg: 'bg-blue-100 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500/5 to-transparent',
    shadow: 'shadow-blue-500/10'
  }
};

const handleAction = (toast: Toast) => {
  if (toast.action) {
    toast.action.handler();
    removeToast(toast.id);
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed bottom-6 z-[100] flex flex-col gap-3 pointer-events-none w-full sm:w-auto items-center sm:items-end sm:right-6 px-4 sm:px-0"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-400 ease-out-expo"
        enter-from-class="opacity-0 translates-y-8 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-90"
        move-class="transition-all duration-400 ease-out-expo"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="group relative overflow-hidden pointer-events-auto w-full sm:w-[380px] p-1 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <!-- Glass Background -->
          <div class="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-white/10 shadow-2xl" />
          
          <!-- Gradient Glow -->
          <div 
            class="absolute inset-0 bg-gradient-to-br opacity-50 rounded-2xl"
            :class="styleMap[toast.type].gradient"
          />

          <!-- Content -->
          <div class="relative flex items-start gap-4 p-4">
            <!-- Icon Bubble -->
            <div 
              class="shrink-0 size-10 rounded-full flex items-center justify-center shadow-sm ring-1 ring-inset ring-black/5"
              :class="styleMap[toast.type].iconBg"
            >
              <span 
                class="material-symbols-outlined text-[20px]"
                :class="styleMap[toast.type].iconColor"
              >
                {{ iconMap[toast.type] }}
              </span>
            </div>

            <div class="flex-1 min-w-0 py-0.5">
              <p class="text-[15px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                {{ toast.message }}
              </p>
              
              <button
                v-if="toast.action"
                @click="handleAction(toast)"
                class="mt-2 text-sm font-semibold text-primary hover:text-primary-focus transition-colors flex items-center gap-1"
              >
                {{ toast.action.label }}
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            <!-- Dismiss Button -->
            <button
              @click="removeToast(toast.id)"
              class="shrink-0 -mr-2 -mt-2 size-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          
          <!-- Subtle Shine -->
          <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 dark:ring-white/5 pointer-events-none" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
