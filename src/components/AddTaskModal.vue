<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [title: string, subtasks: string[]];
}>();

const title = ref('');
const subtasksInput = ref('');
const isListening = ref(false);
let recognition: any = null;

watch(() => props.isOpen, (open) => {
  if (open) {
    title.value = '';
    subtasksInput.value = '';
    isListening.value = false;
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

const handleSubmit = () => {
  if (!title.value.trim()) return;

  const subtasks = subtasksInput.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  emit('save', title.value, subtasks);
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity"
    >
      <div class="bg-white dark:bg-[#1e293b] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all scale-100 pb-safe sm:pb-0">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">Add New Task</h3>
          <button 
            @click="emit('close')"
            class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-6 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Task Title
            </label>
            <div class="relative">
              <input
                v-model="title"
                type="text"
                placeholder="What needs to be done?"
                class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                autofocus
              />
              <button
                type="button"
                @click="toggleListening"
                :class="[
                  'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all',
                  isListening 
                    ? 'text-red-500 bg-red-500/10 animate-pulse' 
                    : 'text-slate-400 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700'
                ]"
                :title="isListening ? 'Stop Listening' : 'Speak to type'"
              >
                <span class="material-symbols-outlined text-[20px]">mic</span>
              </button>
            </div>
            <p v-if="isListening" class="text-xs text-primary font-medium ml-1 animate-pulse">Listening...</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Subtasks <span class="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              v-model="subtasksInput"
              placeholder="Enter subtasks separated by commas..."
              rows="3"
              class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none"
            />
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
