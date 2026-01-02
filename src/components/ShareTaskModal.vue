<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useTaskSharing } from '../composables/useTaskSharing';
import type { Task, ShareLinkResponse } from '../types';

const props = defineProps<{
  isOpen: boolean;
  task: Task | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const {
  shares,
  loading,
  error,
  fetchShares,
  shareByEmail,
  generateShareLink,
  revokeShare,
  clearShares
} = useTaskSharing();

const modalRef = ref<HTMLDivElement | null>(null);
let previousActiveElement: HTMLElement | null = null;

const activeTab = ref<'email' | 'link'>('link');
const inviteEmail = ref('');
const shareLink = ref<ShareLinkResponse | null>(null);
const hasExpiry = ref(false);
const expiryDays = ref(7);
const copySuccess = ref(false);
const localError = ref<string | null>(null);

const isValidEmail = computed(() => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(inviteEmail.value.trim());
});

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
    emit('close');
  }
};

const handleEmailInvite = async () => {
  if (!props.task || !isValidEmail.value) return;
  localError.value = null;

  const result = await shareByEmail(props.task.id, inviteEmail.value.trim());
  if (result) {
    inviteEmail.value = '';
  } else if (error.value) {
    localError.value = error.value;
  }
};

const handleGenerateLink = async () => {
  if (!props.task) return;
  localError.value = null;

  const result = await generateShareLink(
    props.task.id,
    hasExpiry.value ? expiryDays.value : undefined
  );
  if (result) {
    shareLink.value = result;
  } else if (error.value) {
    localError.value = error.value;
  }
};

const copyLinkToClipboard = async () => {
  if (!shareLink.value) return;

  try {
    await navigator.clipboard.writeText(shareLink.value.share_url);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (e) {
    console.error('Failed to copy:', e);
  }
};

const shareToWhatsApp = () => {
  if (!shareLink.value || !props.task) return;
  const message = `Check out this task: ${props.task.title}\n${shareLink.value.share_url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
};

const handleRevoke = async (shareId: string) => {
  if (!props.task) return;
  await revokeShare(shareId, props.task.id);
};

const getShareDisplayName = (share: any) => {
  if (share.shared_user?.email) return share.shared_user.email;
  if (share.shared_with_email) return share.shared_with_email;
  if (share.share_token) return 'Link invite';
  return 'Unknown';
};

watch(() => props.isOpen, async (open) => {
  if (open && props.task) {
    previousActiveElement = document.activeElement as HTMLElement;
    await nextTick();

    // Reset state
    inviteEmail.value = '';
    shareLink.value = null;
    localError.value = null;
    activeTab.value = 'link';

    // Fetch existing shares
    await fetchShares(props.task.id);

    const emailInput = modalRef.value?.querySelector('input[type="email"]') as HTMLElement;
    emailInput?.focus();
    document.addEventListener('keydown', trapFocus);
  } else {
    document.removeEventListener('keydown', trapFocus);
    previousActiveElement?.focus();
    clearShares();
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('keydown', trapFocus);
});
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
        v-if="isOpen && task"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        @click.self="emit('close')"
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
            <!-- Header -->
            <div class="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between mb-2">
                <h3 id="share-modal-title" class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary">share</span>
                  Share Task
                </h3>
                <button
                  @click="emit('close')"
                  class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <span class="material-symbols-outlined text-slate-500">close</span>
                </button>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 truncate">
                {{ task.title }}
              </p>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-slate-200 dark:border-slate-700">
              <button
                @click="activeTab = 'link'"
                :class="[
                  'flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  activeTab === 'link'
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                ]"
              >
                <span class="material-symbols-outlined text-[18px]">link</span>
                Share Link
              </button>
              <button
                @click="activeTab = 'email'"
                :class="[
                  'flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  activeTab === 'email'
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                ]"
              >
                <span class="material-symbols-outlined text-[18px]">mail</span>
                Email Invite
              </button>
            </div>

            <!-- Tab Content -->
            <div class="p-6">
              <!-- Error display -->
              <div v-if="localError" class="mb-4 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {{ localError }}
              </div>

              <!-- Email Tab -->
              <div v-if="activeTab === 'email'" class="space-y-4">
                <div class="flex gap-2">
                  <input
                    v-model="inviteEmail"
                    type="email"
                    placeholder="Enter email address"
                    class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                    @keyup.enter="handleEmailInvite"
                  />
                  <button
                    @click="handleEmailInvite"
                    :disabled="!isValidEmail || loading"
                    class="px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <span v-if="loading" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span v-else class="material-symbols-outlined text-[18px]">send</span>
                    Send
                  </button>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  They'll be able to view and edit this task when they log in.
                </p>
              </div>

              <!-- Link Tab -->
              <div v-if="activeTab === 'link'" class="space-y-4">
                <div v-if="shareLink" class="space-y-3">
                  <input
                    :value="shareLink.share_url"
                    readonly
                    class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                  <div class="flex gap-2">
                    <button
                      @click="copyLinkToClipboard"
                      :class="[
                        'flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                        copySuccess
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      ]"
                    >
                      <span class="material-symbols-outlined text-[18px]">
                        {{ copySuccess ? 'check' : 'content_copy' }}
                      </span>
                      {{ copySuccess ? 'Copied!' : 'Copy' }}
                    </button>
                    <button
                      @click="shareToWhatsApp"
                      class="flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                    >
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </button>
                  </div>
                  <button
                    @click="shareLink = null"
                    class="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Generate new link
                  </button>
                </div>

                <div v-else class="space-y-4">
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        v-model="hasExpiry"
                        type="checkbox"
                        class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                      />
                      Set expiration
                    </label>
                    <select
                      v-if="hasExpiry"
                      v-model="expiryDays"
                      class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                      <option :value="1">1 day</option>
                      <option :value="7">7 days</option>
                      <option :value="30">30 days</option>
                    </select>
                  </div>

                  <button
                    @click="handleGenerateLink"
                    :disabled="loading"
                    class="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <span v-if="loading" class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span v-else class="material-symbols-outlined text-[18px]">link</span>
                    Generate Share Link
                  </button>
                </div>

                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Anyone with the link can view and edit this task after logging in.
                </p>
              </div>

              <!-- Current Shares List -->
              <div v-if="shares.length > 0" class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[18px]">group</span>
                  Shared with ({{ shares.length }})
                </h4>
                <div class="space-y-2 max-h-40 overflow-y-auto">
                  <div
                    v-for="share in shares"
                    :key="share.id"
                    class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-primary text-[16px]">
                          {{ share.share_token ? 'link' : 'person' }}
                        </span>
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {{ getShareDisplayName(share) }}
                        </p>
                        <span
                          :class="[
                            'text-xs px-2 py-0.5 rounded-full',
                            share.status === 'accepted'
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          ]"
                        >
                          {{ share.status }}
                        </span>
                      </div>
                    </div>
                    <button
                      @click="handleRevoke(share.id)"
                      class="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      :title="'Remove access'"
                    >
                      <span class="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
