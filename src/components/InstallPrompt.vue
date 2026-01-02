<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isVisible = ref(false);
const STORAGE_KEY = 'install-prompt-dismissed';
const STORAGE_KEY_IOS = 'ios-install-prompt-dismissed';

// Store the deferred prompt for Chrome/Android
let deferredPrompt: any = null;

// Detect platform
const isIOS = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const isStandalone = () => {
  return (window.navigator as any).standalone === true ||
         window.matchMedia('(display-mode: standalone)').matches;
};

const isIOSDevice = ref(false);

const dismiss = () => {
  isVisible.value = false;
  localStorage.setItem(isIOSDevice.value ? STORAGE_KEY_IOS : STORAGE_KEY, 'true');
};

const handleInstall = async () => {
  if (deferredPrompt) {
    // Show the native install prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      isVisible.value = false;
    }
    deferredPrompt = null;
  }
};

const handleBeforeInstallPrompt = (e: Event) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Store the event for later use
  deferredPrompt = e;

  // Check if user hasn't dismissed before
  if (!localStorage.getItem(STORAGE_KEY) && !isStandalone()) {
    setTimeout(() => {
      isVisible.value = true;
    }, 3000);
  }
};

onMounted(() => {
  // Check if already installed
  if (isStandalone()) return;

  isIOSDevice.value = isIOS();

  if (isIOSDevice.value) {
    // iOS doesn't support beforeinstallprompt, show manual instructions
    if (!localStorage.getItem(STORAGE_KEY_IOS)) {
      setTimeout(() => {
        isVisible.value = true;
      }, 3000);
    }
  } else {
    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
            <div class="shrink-0 w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <span class="material-symbols-outlined text-white text-2xl" style="font-variation-settings: 'FILL' 1;">task_alt</span>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">
                Install EZtodo
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Install for quick access and push notifications
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

          <!-- iOS Instructions -->
          <div v-if="isIOSDevice" class="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
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

        <!-- Bottom actions -->
        <div class="px-4 py-3 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button
            @click="dismiss"
            class="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors rounded-xl"
          >
            Maybe later
          </button>
          <button
            v-if="!isIOSDevice && deferredPrompt"
            @click="handleInstall"
            class="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">download</span>
            Install
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
