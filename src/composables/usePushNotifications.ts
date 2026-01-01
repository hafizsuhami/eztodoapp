import { ref, computed, onMounted } from 'vue';

// OneSignal configuration - set these in your .env file
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
const SAFARI_WEB_ID = import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID || '';

// Check if running on iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

// Check if app is installed as PWA
const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

// Singleton state - shared across all component instances
let oneSignalInstance: any = null;
let initPromise: Promise<void> | null = null;
let isInitialized = false;

// Shared reactive state
const isSupported = ref(false);
const isSubscribed = ref(false);
const isLoading = ref(true);
const permissionState = ref<'default' | 'granted' | 'denied'>('default');
const showIOSPrompt = ref(false);
const oneSignalUserId = ref<string | null>(null);

// Initialize OneSignal - singleton pattern
const initOneSignal = async (): Promise<void> => {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  // Skip if already initialized successfully
  if (isInitialized && oneSignalInstance) {
    isLoading.value = false;
    return;
  }

  initPromise = (async () => {
    if (!ONESIGNAL_APP_ID) {
      isLoading.value = false;
      return;
    }

    // Check if OneSignal SDK is loaded
    if (typeof window === 'undefined' || !(window as any).OneSignalDeferred) {
      isLoading.value = false;
      return;
    }

    try {
      const OneSignalDeferred = (window as any).OneSignalDeferred;

      await new Promise<void>((resolve, reject) => {
        OneSignalDeferred.push(async (OneSignal: any) => {
          try {
            await OneSignal.init({
              appId: ONESIGNAL_APP_ID,
              safari_web_id: SAFARI_WEB_ID || undefined,
              allowLocalhostAsSecureOrigin: true,
              notifyButton: {
                enable: false
              },
              welcomeNotification: {
                title: 'EZtodo',
                message: 'Thanks for subscribing to reminders!'
              }
            });

            // Store the instance for later use
            oneSignalInstance = OneSignal;
            isInitialized = true;

            isSupported.value = OneSignal.Notifications.isPushSupported();

            // Check current permission state
            const permission = OneSignal.Notifications.permission;
            permissionState.value = permission ? 'granted' : 'default';
            isSubscribed.value = !!permission;

            // Get user ID if subscribed
            if (permission) {
              try {
                const userId = await OneSignal.User.PushSubscription.id;
                oneSignalUserId.value = userId || null;
              } catch (e) {
                // Ignore
              }
            }

            // Listen for subscription changes
            OneSignal.Notifications.addEventListener('permissionChange', (granted: boolean) => {
              permissionState.value = granted ? 'granted' : 'denied';
              isSubscribed.value = granted;
            });

            resolve();
          } catch (error: any) {
            // Handle "already initialized" - try to recover
            if (error?.message?.includes('already initialized')) {
              oneSignalInstance = OneSignal;
              isInitialized = true;
              isSupported.value = OneSignal.Notifications?.isPushSupported() || false;

              try {
                const permission = OneSignal.Notifications?.permission;
                isSubscribed.value = !!permission;
                permissionState.value = permission ? 'granted' : 'default';
              } catch (e) {
                // Ignore
              }

              resolve();
            } else if (error?.message?.includes("AppID doesn't match") || error?.message?.includes('AppID mismatch')) {
              // Auto-clear OneSignal cached data and reload
              try {
                // Clear OneSignal IndexedDB databases
                const dbNames = ['ONE_SIGNAL_SDK_DB', 'onesignal-notification-database'];
                for (const dbName of dbNames) {
                  try {
                    await new Promise<void>((res, rej) => {
                      const req = indexedDB.deleteDatabase(dbName);
                      req.onsuccess = () => res();
                      req.onerror = () => rej(req.error);
                      req.onblocked = () => res(); // Continue even if blocked
                    });
                  } catch (e) {
                    // Ignore
                  }
                }
                // Clear localStorage OneSignal keys
                Object.keys(localStorage).forEach(key => {
                  if (key.startsWith('onesignal') || key.startsWith('ONE_SIGNAL')) {
                    localStorage.removeItem(key);
                  }
                });
                window.location.reload();
              } catch (clearError) {
                reject(new Error('Please clear your browser site data and refresh the page.'));
              }
              return;
            } else {
              reject(error);
            }
          }
        });
      });
    } catch (error) {
      // Initialization failed
    } finally {
      isLoading.value = false;
    }
  })();

  return initPromise;
};

// External user ID for linking to Supabase user
let externalUserId: string | null = null;

export function usePushNotifications() {
  // iOS needs PWA to support push
  const needsPWAInstall = computed(() => isIOS() && !isPWA());

  // Request permission and subscribe
  const subscribe = async (): Promise<boolean> => {
    if (needsPWAInstall.value) {
      showIOSPrompt.value = true;
      return false;
    }

    // Ensure initialized
    await initOneSignal();

    if (!oneSignalInstance) {
      return false;
    }

    isLoading.value = true;

    try {
      await oneSignalInstance.Notifications.requestPermission();

      const permission = oneSignalInstance.Notifications.permission;

      if (permission) {
        isSubscribed.value = true;
        permissionState.value = 'granted';
        try {
          const userId = await oneSignalInstance.User.PushSubscription.id;
          oneSignalUserId.value = userId || null;

          // If we have an external user ID queued, set it now
          if (externalUserId) {
            await oneSignalInstance.login(externalUserId);
          }
        } catch (e) {
          // Ignore
        }
        return true;
      } else {
        permissionState.value = 'denied';
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Set external user ID (for targeting specific users)
  const setExternalUserId = async (userId: string) => {
    // Store for later use (e.g., if called before subscription)
    externalUserId = userId;

    await initOneSignal();
    if (!oneSignalInstance) {
      return;
    }

    try {
      await oneSignalInstance.login(userId);
    } catch (error) {
      // Failed to set external user ID
    }
  };

  // Add tags for segmentation
  const addTags = async (tags: Record<string, string>) => {
    await initOneSignal();
    if (!oneSignalInstance) return;

    try {
      await oneSignalInstance.User.addTags(tags);
    } catch (error) {
      // Failed to add tags
    }
  };

  // Dismiss iOS prompt
  const dismissIOSPrompt = () => {
    showIOSPrompt.value = false;
  };

  onMounted(() => {
    initOneSignal();
  });

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permissionState,
    showIOSPrompt,
    needsPWAInstall,
    oneSignalUserId,
    subscribe,
    setExternalUserId,
    addTags,
    dismissIOSPrompt
  };
}
