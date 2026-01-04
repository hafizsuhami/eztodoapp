<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { CategoryOption, CategoryId, Subtask } from '../types';
import { usePushNotifications } from '../composables/usePushNotifications';
import { parseTaskInput, formatParsedDate } from '../lib/parseTaskInput';

const props = defineProps<{
  isOpen: boolean;
  categories: CategoryOption[];
}>();

const emit = defineEmits<{
  close: [];
  save: [title: string, subtasks: string[], category: CategoryId, dueDate: string, reminderAt: string | null];
}>();

const { isSubscribed, subscribe, needsPWAInstall, showIOSPrompt, dismissIOSPrompt } = usePushNotifications();

const title = ref('');
const subtasks = ref<Subtask[]>([]);
const newSubtaskTitle = ref('');
const selectedCategory = ref<CategoryId>('');
const dueDate = ref('');
const reminderEnabled = ref(false);
const reminderDate = ref('');
const reminderTime = ref('09:00');
const isListening = ref(false);
const modalRef = ref<HTMLDivElement | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);
let recognition: any = null;

// NLI: Track if fields were auto-filled (to avoid overwriting manual changes)
const autoFilledCategory = ref(false);
const autoFilledDate = ref(false);
const autoFilledReminder = ref(false);

// NLI: Parse the title input for natural language
const parsedTask = computed(() => {
  if (!title.value.trim()) return null;
  return parseTaskInput(title.value, props.categories);
});

// NLI: Show preview only when we detect something
const showNLIPreview = computed(() => {
  if (!parsedTask.value) return false;
  return parsedTask.value.dueDate || parsedTask.value.categoryId || parsedTask.value.hasReminder;
});

const defaultCategoryId = computed(() => props.categories[0]?.id || '');

// Focus trap
const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
let previousActiveElement: HTMLElement | null = null;

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

watch(() => props.isOpen, async (open) => {
  if (open) {
    title.value = '';
    subtasks.value = [];
    newSubtaskTitle.value = '';
    selectedCategory.value = defaultCategoryId.value;
    dueDate.value = '';
    reminderEnabled.value = false;
    reminderDate.value = '';
    reminderTime.value = '09:00';
    isListening.value = false;
    // Reset NLI auto-fill tracking
    autoFilledCategory.value = false;
    autoFilledDate.value = false;
    autoFilledReminder.value = false;

    previousActiveElement = document.activeElement as HTMLElement;
    await nextTick();
    titleInputRef.value?.focus();
    document.addEventListener('keydown', trapFocus);
  } else {
    document.removeEventListener('keydown', trapFocus);
    previousActiveElement?.focus();
  }
});

// NLI: Auto-fill fields when natural language is detected
watch(parsedTask, (parsed) => {
  if (!parsed) return;

  // Auto-fill category if detected and not manually changed
  if (parsed.categoryId && !autoFilledCategory.value) {
    selectedCategory.value = parsed.categoryId;
    autoFilledCategory.value = true;
  }

  // Auto-fill due date if detected and not manually changed
  if (parsed.dueDate && !autoFilledDate.value) {
    const dateStr = parsed.dueDate.toISOString().split('T')[0];
    dueDate.value = dateStr;
    autoFilledDate.value = true;
  }

  // Auto-enable reminder if detected and not manually changed
  if (parsed.hasReminder && !autoFilledReminder.value && !reminderEnabled.value) {
    reminderEnabled.value = true;
    autoFilledReminder.value = true;
    // Set reminder date to due date or today
    if (dueDate.value) {
      reminderDate.value = dueDate.value;
    } else if (parsed.dueDate) {
      reminderDate.value = parsed.dueDate.toISOString().split('T')[0];
    } else {
      reminderDate.value = new Date().toISOString().split('T')[0];
    }
    // Set time from parsed date if available
    if (parsed.dueDate) {
      const hours = parsed.dueDate.getHours();
      const minutes = parsed.dueDate.getMinutes();
      if (hours !== 0 || minutes !== 0) {
        reminderTime.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
  }
});

const toggleListening = () => {
  if (isListening.value) {
    stopListening();
  } else {
    startListening();
  }
};

const startListening = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("Speech recognition is not supported in this browser.");
    return;
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening.value = true;
  };

  recognition.onend = () => {
    isListening.value = false;
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    title.value = title.value ? `${title.value} ${transcript}` : transcript;
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error", event.error);
    isListening.value = false;
  };

  recognition.start();
};

const stopListening = () => {
  if (recognition) {
    recognition.stop();
  }
};

// Subtask management
const toggleSubtask = (subtaskId: string) => {
  subtasks.value = subtasks.value.map(s =>
    s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
  );
};

const updateSubtaskTitle = (subtaskId: string, newTitle: string) => {
  subtasks.value = subtasks.value.map(s =>
    s.id === subtaskId ? { ...s, title: newTitle } : s
  );
};

const removeSubtask = (subtaskId: string) => {
  subtasks.value = subtasks.value.filter(s => s.id !== subtaskId);
};

const addSubtask = () => {
  if (newSubtaskTitle.value.trim()) {
    const newSubtask: Subtask = {
      id: Date.now().toString() + Math.random().toString(),
      title: newSubtaskTitle.value.trim(),
      is_completed: false
    };
    subtasks.value = [...subtasks.value, newSubtask];
    newSubtaskTitle.value = '';
  }
};

const handleAddSubtaskKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addSubtask();
  }
};

const handleSubmit = () => {
  if (!title.value.trim()) return;

  // Use parsed clean title if NLI detected something, otherwise use raw title
  const finalTitle = parsedTask.value?.title || title.value.trim();

  const subtaskTitles = subtasks.value
    .filter(s => s.title.trim())
    .map(s => s.title);

  // Build reminder timestamp if enabled
  let reminderAt: string | null = null;
  if (reminderEnabled.value && reminderDate.value && reminderTime.value) {
    reminderAt = new Date(`${reminderDate.value}T${reminderTime.value}`).toISOString();
  }

  emit('save', finalTitle, subtaskTitles, selectedCategory.value, dueDate.value || 'No Due Date', reminderAt);
  emit('close');
};

// Handle enabling reminder - prompt for notification permission if needed
const handleReminderToggle = async () => {
  if (!reminderEnabled.value) {
    // Enabling reminder
    if (!isSubscribed.value) {
      const granted = await subscribe();
      if (!granted) {
        return; // Don't enable if permission not granted
      }
    }
    reminderEnabled.value = true;
    // Set default reminder date to due date or today
    if (dueDate.value) {
      reminderDate.value = dueDate.value;
    } else {
      reminderDate.value = new Date().toISOString().split('T')[0];
    }
  } else {
    reminderEnabled.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-4 sm:pt-12 bg-slate-900/50 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-modal-title"
      @click.self="emit('close')"
    >
      <div 
        ref="modalRef"
        class="bg-white dark:bg-[#1e293b] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all scale-100 pb-safe sm:pb-0"
      >
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 id="add-task-modal-title" class="text-lg font-bold text-slate-900 dark:text-white">Add New Task</h3>
          <button 
            @click="emit('close')"
            class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
            aria-label="Close modal"
          >
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="px-4 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div class="flex flex-col gap-1.5">
            <label for="task-title" class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Task Title
            </label>
            <div class="relative">
              <input
                id="task-title"
                ref="titleInputRef"
                v-model="title"
                type="text"
                placeholder="What needs to be done?"
                class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              <button
                type="button"
                @click="toggleListening"
                :class="[
                  'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary/50',
                  isListening 
                    ? 'text-red-500 bg-red-500/10 animate-pulse' 
                    : 'text-slate-400 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700'
                ]"
                :aria-label="isListening ? 'Stop voice input' : 'Start voice input'"
                :aria-pressed="isListening"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">mic</span>
              </button>
            </div>
            <p v-if="isListening" class="text-xs text-primary font-medium ml-1 animate-pulse" role="status">Listening...</p>

            <!-- NLI Preview -->
            <div
              v-if="showNLIPreview && parsedTask"
              class="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm space-y-1.5"
            >
              <p class="text-xs font-medium text-primary/70 uppercase tracking-wide">Detected</p>
              <div class="flex flex-wrap gap-2">
                <span v-if="parsedTask.title" class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 shadow-sm">
                  <span class="material-symbols-outlined text-[14px] text-slate-400">edit</span>
                  {{ parsedTask.title }}
                </span>
                <span v-if="parsedTask.dueDate" class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 shadow-sm">
                  <span class="material-symbols-outlined text-[14px] text-blue-500">calendar_today</span>
                  {{ formatParsedDate(parsedTask.dueDate) }}
                </span>
                <span v-if="parsedTask.categoryName" class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 shadow-sm">
                  <span class="material-symbols-outlined text-[14px] text-green-500">label</span>
                  {{ parsedTask.categoryName }}
                </span>
                <span v-if="parsedTask.hasReminder" class="inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 shadow-sm">
                  <span class="material-symbols-outlined text-[14px] text-amber-500">notifications</span>
                  Reminder
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Subtasks <span class="text-slate-400 font-normal">(Optional)</span>
            </label>
            
            <!-- Existing Subtasks -->
            <div v-if="subtasks.length > 0" class="flex flex-col gap-2">
              <div
                v-for="subtask in subtasks"
                :key="subtask.id"
                class="flex items-center gap-2 bg-slate-50 dark:bg-[#161f30] rounded-lg px-3 py-2 group"
              >
                <!-- Toggle Checkbox -->
                <label class="relative flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    :checked="subtask.is_completed"
                    @change="toggleSubtask(subtask.id)"
                    class="sr-only"
                  />
                  <div :class="[
                    'size-5 border-2 rounded flex items-center justify-center transition-colors',
                    subtask.is_completed 
                      ? 'bg-primary border-primary' 
                      : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                  ]">
                    <svg v-if="subtask.is_completed" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                  </div>
                </label>
                
                <!-- Editable Title -->
                <input
                  type="text"
                  :value="subtask.title"
                  @input="updateSubtaskTitle(subtask.id, ($event.target as HTMLInputElement).value)"
                  :class="[
                    'flex-1 bg-transparent border-none text-sm focus:outline-none focus:ring-0',
                    subtask.is_completed 
                      ? 'line-through text-slate-400 dark:text-slate-500' 
                      : 'text-slate-700 dark:text-slate-200'
                  ]"
                  placeholder="Subtask title..."
                />
                
                <!-- Remove Button -->
                <button
                  type="button"
                  @click="removeSubtask(subtask.id)"
                  class="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 -m-1"
                  title="Remove subtask"
                >
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            <!-- Add New Subtask -->
            <div class="flex items-center gap-2 mt-1">
              <input
                v-model="newSubtaskTitle"
                type="text"
                placeholder="Add a subtask..."
                @keydown="handleAddSubtaskKeydown"
                class="flex-1 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              <button
                type="button"
                @click="addSubtask"
                :disabled="!newSubtaskTitle.trim()"
                class="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Add subtask"
              >
                <span class="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Due Date <span class="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              v-model="dueDate"
              type="date"
              class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>

          <!-- Reminder Section -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Reminder <span class="text-slate-400 font-normal">(Optional)</span>
              </label>
              <button
                type="button"
                @click="handleReminderToggle"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  reminderEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                ]"
                role="switch"
                :aria-checked="reminderEnabled"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                    reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                  ]"
                />
              </button>
            </div>
            
            <!-- Reminder Date/Time Picker -->
            <div v-if="reminderEnabled" class="flex gap-2 animate-in slide-in-from-top-2 duration-200">
              <input
                v-model="reminderDate"
                type="date"
                class="flex-1 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              <input
                v-model="reminderTime"
                type="time"
                class="w-28 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>
            
            <!-- iOS PWA Prompt -->
            <div v-if="showIOSPrompt" class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-amber-500 text-[20px] mt-0.5">info</span>
                <div class="flex-1">
                  <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Install app for reminders</p>
                  <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    On iPhone, tap <span class="material-symbols-outlined text-[14px] align-middle">ios_share</span> then "Add to Home Screen" to enable push notifications.
                  </p>
                  <button
                    type="button"
                    @click="dismissIOSPrompt"
                    class="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
            
            <p v-if="reminderEnabled && !showIOSPrompt" class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">notifications</span>
              You'll receive a notification at this time
            </p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Category
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="cat in categories"
                :key="cat.id"
                type="button"
                @click="selectedCategory = cat.id"
                :class="[
                  'flex items-center justify-between w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors',
                  selectedCategory === cat.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                ]"
              >
                <span class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: cat.color }"></span>
                  {{ cat.name }}
                </span>
                <span
                  v-if="selectedCategory === cat.id"
                  class="material-symbols-outlined text-[18px] text-primary"
                >
                  check
                </span>
              </button>
            </div>
          </div>

          <div class="flex gap-3 mt-2">
            <button
              type="button"
              @click="emit('close')"
              class="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="!title.trim()"
              class="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
