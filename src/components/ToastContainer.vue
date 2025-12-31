<script setup lang="ts">
import { useToast, type Toast } from '../composables/useToast';

const { toasts, removeToast } = useToast();

const iconMap: Record<Toast['type'], string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

const colorMap: Record<Toast['type'], { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: 'text-emerald-500',
    border: 'border-emerald-200 dark:border-emerald-500/20'
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    icon: 'text-red-500',
    border: 'border-red-200 dark:border-red-500/20'
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon: 'text-amber-500',
    border: 'border-amber-200 dark:border-amber-500/20'
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    icon: 'text-blue-500',
    border: 'border-blue-200 dark:border-blue-500/20'
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
      class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-x-8 scale-95"
        move-class="transition-all duration-300"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-start gap-3 p-4 rounded-xl border shadow-lg pointer-events-auto',
            colorMap[toast.type].bg,
            colorMap[toast.type].border
          ]"
          role="alert"
        >
          <span
            :class="['material-symbols-outlined text-[20px] shrink-0 mt-0.5', colorMap[toast.type].icon]"
            aria-hidden="true"
          >
            {{ iconMap[toast.type] }}
          </span>
          
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-900 dark:text-white">
              {{ toast.message }}
            </p>
            <button
              v-if="toast.action"
              @click="handleAction(toast)"
              class="mt-1 text-sm font-semibold text-primary hover:underline"
            >
              {{ toast.action.label }}
            </button>
          </div>
          
          <button
            @click="removeToast(toast.id)"
            class="shrink-0 p-1 -m-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Dismiss notification"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
