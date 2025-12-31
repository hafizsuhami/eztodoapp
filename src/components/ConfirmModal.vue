<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: string;
}>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to continue?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
  icon: 'warning'
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const modalRef = ref<HTMLDivElement | null>(null);
const confirmButtonRef = ref<HTMLButtonElement | null>(null);
let previousActiveElement: HTMLElement | null = null;

const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const trapFocus = (event: KeyboardEvent) => {
  if (!props.isOpen || !modalRef.value) return;
  if (event.key !== 'Tab') return;
  
  const focusableElements = modalRef.value.querySelectorAll(focusableSelectors);
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
  
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    emit('cancel');
  }
};

watch(() => props.isOpen, async (open) => {
  if (open) {
    previousActiveElement = document.activeElement as HTMLElement;
    await nextTick();
    // Focus cancel button by default for safety (not the destructive action)
    const cancelBtn = modalRef.value?.querySelector('[data-cancel-btn]') as HTMLElement;
    cancelBtn?.focus();
    document.addEventListener('keydown', trapFocus);
  } else {
    document.removeEventListener('keydown', trapFocus);
    previousActiveElement?.focus();
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('keydown', trapFocus);
});

const variantClasses = {
  danger: {
    icon: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
    button: 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
  },
  warning: {
    icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    button: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
  },
  info: {
    icon: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    button: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'confirm-modal-title'"
        :aria-describedby="'confirm-modal-message'"
        @click.self="emit('cancel')"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="isOpen"
            ref="modalRef"
            class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            <!-- Content -->
            <div class="flex flex-col items-center text-center px-6 py-8">
              <!-- Icon -->
              <div
                :class="[
                  'size-16 rounded-full flex items-center justify-center mb-4',
                  variantClasses[variant].icon
                ]"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[32px]">{{ icon }}</span>
              </div>

              <!-- Title -->
              <h3 id="confirm-modal-title" class="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {{ title }}
              </h3>

              <!-- Message -->
              <p id="confirm-modal-message" class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {{ message }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 px-6 pb-6">
              <button
                data-cancel-btn
                @click="emit('cancel')"
                class="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/50"
              >
                {{ cancelText }}
              </button>
              <button
                ref="confirmButtonRef"
                @click="emit('confirm')"
                :class="[
                  'flex-1 py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variantClasses[variant].button
                ]"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
