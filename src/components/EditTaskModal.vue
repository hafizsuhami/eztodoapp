<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Task, CategoryOption, CategoryId, Subtask } from '../types';

const props = defineProps<{
  isOpen: boolean;
  task: Task | null;
  categories: CategoryOption[];
}>();

const emit = defineEmits<{
  close: [];
  save: [taskId: string, title: string, subtasks: Subtask[], category: CategoryId, dueDate: string];
}>();

// Form state
const editTitle = ref('');
const editDueDate = ref('');
const editCategory = ref<CategoryId>('');
const editSubtasks = ref<Subtask[]>([]);

// Voice recognition
const isListening = ref(false);
let recognition: any = null;

// New subtask input
const newSubtaskTitle = ref('');

// Populate form when task changes
watch(() => props.task, (task) => {
  if (task) {
    editTitle.value = task.title;
    editDueDate.value = task.due_date === 'No Due Date' ? '' : task.due_date;
    editCategory.value = task.category;
    editSubtasks.value = task.subtasks ? task.subtasks.map(s => ({ ...s })) : [];
  }
}, { immediate: true });

// Reset when modal closes
watch(() => props.isOpen, (open) => {
  if (!open) {
    isListening.value = false;
    newSubtaskTitle.value = '';
    if (recognition) {
      recognition.stop();
    }
  }
});

// Voice recognition
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
    editTitle.value = editTitle.value ? `${editTitle.value} ${transcript}` : transcript;
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
  editSubtasks.value = editSubtasks.value.map(s =>
    s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
  );
};

const updateSubtaskTitle = (subtaskId: string, newTitle: string) => {
  editSubtasks.value = editSubtasks.value.map(s =>
    s.id === subtaskId ? { ...s, title: newTitle } : s
  );
};

const removeSubtask = (subtaskId: string) => {
  editSubtasks.value = editSubtasks.value.filter(s => s.id !== subtaskId);
};

const addSubtask = () => {
  if (newSubtaskTitle.value.trim()) {
    const newSubtask: Subtask = {
      id: Date.now().toString() + Math.random().toString(),
      title: newSubtaskTitle.value.trim(),
      is_completed: false
    };
    editSubtasks.value = [...editSubtasks.value, newSubtask];
    newSubtaskTitle.value = '';
  }
};

const handleAddSubtaskKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addSubtask();
  }
};

// Form submission
const handleSubmit = () => {
  if (!editTitle.value.trim() || !props.task) return;

  emit('save',
    props.task.id,
    editTitle.value.trim(),
    editSubtasks.value.filter(s => s.title.trim()),
    editCategory.value,
    editDueDate.value || 'No Due Date'
  );
  emit('close');
};

const handleClose = () => {
  emit('close');
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
        v-if="isOpen && task"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="handleClose"
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
            v-if="isOpen && task"
            class="bg-white dark:bg-[#1e293b] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all pb-safe sm:pb-0"
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">Edit Task</h3>
              <button 
                @click="handleClose"
                class="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="px-4 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <!-- Task Title -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Task Title
                </label>
                <div class="relative">
                  <input
                    v-model="editTitle"
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

              <!-- Due Date -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Due Date <span class="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  v-model="editDueDate"
                  type="date"
                  class="w-full bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <!-- Category -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="cat in categories"
                    :key="cat.id"
                    type="button"
                    @click="editCategory = cat.id"
                    :class="[
                      'flex items-center justify-between w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors',
                      editCategory === cat.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    ]"
                  >
                    <span class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: cat.color }"></span>
                      {{ cat.name }}
                    </span>
                    <span
                      v-if="editCategory === cat.id"
                      class="material-symbols-outlined text-[18px] text-primary"
                    >
                      check
                    </span>
                  </button>
                </div>
              </div>

              <!-- Subtasks -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Subtasks <span class="text-slate-400 font-normal">(Optional)</span>
                </label>
                
                <!-- Existing Subtasks -->
                <div v-if="editSubtasks.length > 0" class="flex flex-col gap-2">
                  <div
                    v-for="subtask in editSubtasks"
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

              <!-- Action Buttons -->
              <div class="flex gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  @click="handleClose"
                  class="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="!editTitle.trim()"
                  class="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
