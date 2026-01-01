<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isVisible = ref(false);
const STORAGE_KEY = 'ios-install-prompt-dismissed';

// Check if running on iOS Safari (not in PWA mode)
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isStandalone = (window.navigator as any).standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
};

const dismiss = () => {
  isVisible.value = false;
  localStorage.setItem(STORAGE_KEY, 'true');
};

onMounted(() => {
  // Only show on iOS Safari, and only if not previously dismissed
  if (isIOSSafari() && !localStorage.getItem(STORAGE_KEY)) {
    // Delay showing to not interrupt initial experience
    setTimeout(() => {
      isVisible.value = true;
    }, 3000);
  }
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-full"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-full"
  >
    <div 
      v-if="isVisible"
      class="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe"
    >
      <div class="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div class="p-4">
          <div class="flex items-start gap-3">
            <!-- App Icon -->
            <div class="shrink-0 w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/30">
              <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings: 'FILL' 1;">task_alt</span>
            </div>
            
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                Install EZtodo
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Add to Home Screen for the best experience and push notifications
              </p>
            </div>
            
            <button
              @click="dismiss"
              class="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Dismiss"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          
          <!-- Instructions -->
          <div class="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
            <div class="flex items-center gap-3 text-sm">
              <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <span class="material-symbols-outlined text-[20px]">ios_share</span>
              </div>
              <div class="flex-1">
                <p class="font-medium text-slate-700 dark:text-slate-200">
                  Tap the Share button
                </p>
                <p class="text-slate-500 dark:text-slate-400 text-xs">
                  Then scroll down and tap "Add to Home Screen"
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Bottom action -->
        <div class="px-4 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700">
          <button
            @click="dismiss"
            class="w-full py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
