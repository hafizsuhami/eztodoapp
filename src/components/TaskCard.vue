<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Task, CategoryOption, CategoryId } from '../types';
import ConfirmModal from './ConfirmModal.vue';

const props = defineProps<{
  task: Task;
  categories: CategoryOption[];
}>();

const emit = defineEmits<{
  toggle: [];
  delete: [];
  edit: [id: string];
  toggleSubtask: [taskId: string, subtaskId: string];
  deleteSubtask: [taskId: string, subtaskId: string];
  updateSubtaskTitle: [taskId: string, subtaskId: string, newTitle: string];
  updateCategory: [taskId: string, newCategory: CategoryId];
}>();

const isCategoryOpen = ref(false);
const categoryMenuRef = ref<HTMLDivElement | null>(null);
const showDeleteConfirm = ref(false);
const justCompleted = ref(false);

const currentCategory = computed(() => {
  return props.categories.find(c => c.id === props.task.category) || { id: '', name: 'Unknown', color: '#94a3b8' };
});

// Check if task is overdue
const isOverdue = computed(() => {
  if (props.task.is_completed) return false;
  if (!props.task.due_date || props.task.due_date === 'No Due Date') return false;
  const taskDate = new Date(props.task.due_date);
  taskDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return taskDate.getTime() < today.getTime();
});

// Check if task is due today
const isDueToday = computed(() => {
  if (props.task.is_completed) return false;
  if (!props.task.due_date || props.task.due_date === 'No Due Date') return false;
  const taskDate = new Date(props.task.due_date);
  taskDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return taskDate.getTime() === today.getTime();
});

const handleClickOutside = (event: MouseEvent) => {
  if (categoryMenuRef.value && !categoryMenuRef.value.contains(event.target as Node)) {
    isCategoryOpen.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!isCategoryOpen.value) return;
  if (event.key === 'Escape') {
    isCategoryOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});

const handleToggle = () => {
  if (!props.task.is_completed) {
    justCompleted.value = true;
    setTimeout(() => {
      justCompleted.value = false;
    }, 600);
  }
  emit('toggle');
};

const handleDeleteClick = () => {
  showDeleteConfirm.value = true;
};

const handleConfirmDelete = () => {
  showDeleteConfirm.value = false;
  emit('delete');
};

const handleSubtaskTitleChange = (subtaskId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('updateSubtaskTitle', props.task.id, subtaskId, target.value);
};

const handleCategoryKeydown = (event: KeyboardEvent, catId: CategoryId) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    emit('updateCategory', props.task.id, catId);
    isCategoryOpen.value = false;
  }
};
</script>

<template>
  <div 
    :class="[
      'group flex flex-col sm:flex-row sm:items-start p-4 rounded-xl border transition-all duration-200 ease-in-out',
      task.is_completed 
        ? 'bg-slate-50 dark:bg-[#161f30] border-transparent hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100' 
        : `bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] ${isCategoryOpen ? 'z-20' : 'hover:z-10'}`
    ]"
  >
    <div class="flex items-start gap-4 flex-1 w-full">
      <!-- Checkbox -->
      <label class="relative flex items-center p-2 -m-2 mt-0 cursor-pointer shrink-0">
        <input 
          type="checkbox" 
          :checked="task.is_completed"
          @change="handleToggle"
          class="custom-checkbox peer sr-only"
          :aria-label="task.is_completed ? `Mark '${task.title}' as incomplete` : `Mark '${task.title}' as complete`"
        />
        <div 
          :class="[
            'size-6 border-2 rounded-md bg-transparent flex items-center justify-center transition-all duration-200 hover:border-primary',
            task.is_completed ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-500',
            justCompleted ? 'scale-110 animate-bounce-once' : ''
          ]"
        >
          <svg 
            v-if="task.is_completed" 
            :class="['w-4 h-4 text-white transition-transform duration-200', justCompleted ? 'scale-110' : '']" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="3" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>
      </label>

      <div class="flex flex-col gap-1 w-full min-w-0">
        <div class="flex flex-wrap justify-between gap-2">
          <span :class="[
            'text-base font-semibold transition-colors decoration-2 truncate pr-2',
            task.is_completed 
              ? 'line-through text-slate-500 dark:text-slate-400' 
              : 'text-slate-900 dark:text-white'
          ]">
            {{ task.title }}
          </span>
          
          <!-- Mobile Actions -->
          <span class="flex sm:hidden ml-auto gap-3 shrink-0">
             <button 
               @click="emit('edit', task.id)" 
               class="text-slate-400 active:text-primary p-1 -m-1"
               :aria-label="`Edit task: ${task.title}`"
             >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
             </button>
             <button 
               @click="handleDeleteClick" 
               class="text-slate-400 active:text-red-500 p-1 -m-1"
               :aria-label="`Delete task: ${task.title}`"
             >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
             </button>
          </span>
        </div>
        
        <!-- Subtasks List -->
        <div v-if="task.subtasks && task.subtasks.length > 0" class="flex flex-col gap-2 mt-1 mb-2" role="list" aria-label="Subtasks">
          <div v-for="subtask in task.subtasks" :key="subtask.id" class="flex items-center gap-2 group/subtask w-full" role="listitem">
            <label class="relative flex items-center p-0 cursor-pointer shrink-0">
                <input
                    type="checkbox"
                    :checked="subtask.is_completed"
                    @change="emit('toggleSubtask', task.id, subtask.id)"
                    class="custom-checkbox peer sr-only"
                    :aria-label="subtask.is_completed ? `Mark '${subtask.title}' as incomplete` : `Mark '${subtask.title}' as complete`"
                />
                <div :class="[
                  'size-4 border-2 rounded bg-transparent flex items-center justify-center transition-colors hover:border-primary',
                  subtask.is_completed ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                ]">
                    <svg v-if="subtask.is_completed" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </div>
            </label>
            <input
              type="text"
              :value="subtask.title"
              @input="handleSubtaskTitleChange(subtask.id, $event)"
              :aria-label="`Edit subtask: ${subtask.title}`"
              :class="[
                'flex-1 min-w-0 text-sm leading-tight bg-transparent border-none p-0 focus:ring-0 focus:outline-none focus:underline cursor-text transition-colors',
                subtask.is_completed 
                ? 'line-through text-slate-400 dark:text-slate-500' 
                : 'text-slate-600 dark:text-slate-300'
              ]"
            />
            <button 
              @click="emit('deleteSubtask', task.id, subtask.id)"
              class="ml-auto text-slate-400 hover:text-red-500 sm:opacity-0 sm:group-hover/subtask:opacity-100 transition-opacity p-0.5"
              :aria-label="`Delete subtask: ${subtask.title}`"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-xs mt-1">
          <!-- Overdue Badge -->
          <span 
            v-if="isOverdue" 
            class="flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <span class="material-symbols-outlined text-[14px]">warning</span>
            Overdue
          </span>

          <!-- Due Today Badge -->
          <span 
            v-else-if="isDueToday" 
            class="flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          >
            <span class="material-symbols-outlined text-[14px]">today</span>
            Today
          </span>

          <!-- Due Date Badge (for other dates) -->
          <span 
            v-else-if="task.due_date && task.due_date !== 'No Due Date'"
            :class="['flex items-center gap-1 font-medium px-2 py-0.5 rounded', task.due_date_bg || 'bg-slate-100 dark:bg-slate-800', task.due_date_color || 'text-slate-500']"
          >
            <span class="material-symbols-outlined text-[14px]">{{ task.due_date_icon || 'calendar_today' }}</span>
            {{ task.due_date }}
          </span>

          <!-- Category Badge -->
          <div class="relative" ref="categoryMenuRef">
            <button
              @click="isCategoryOpen = !isCategoryOpen"
              :aria-expanded="isCategoryOpen"
              aria-haspopup="listbox"
              :aria-label="`Category: ${currentCategory.name}. Click to change.`"
              :class="[
                'flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 -ml-1.5 transition-colors',
                task.is_completed ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
              ]"
            >
              <span 
                class="size-2 rounded-full"
                :style="{ backgroundColor: currentCategory.color }"
                :class="[task.is_completed ? 'opacity-50' : '']"
                aria-hidden="true"
              ></span>
              {{ currentCategory.name }}
            </button>

            <div
              v-if="isCategoryOpen"
              role="listbox"
              :aria-label="`Select category for ${task.title}`"
              class="absolute bottom-full mb-1 left-0 w-32 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col overflow-hidden"
            >
              <button
                v-for="cat in categories"
                :key="cat.id"
                role="option"
                :aria-selected="task.category === cat.id"
                @click="emit('updateCategory', task.id, cat.id); isCategoryOpen = false"
                @keydown="handleCategoryKeydown($event, cat.id)"
                :class="[
                  'flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:bg-slate-50 dark:focus:bg-slate-700/50 focus:outline-none',
                  task.category === cat.id ? 'bg-slate-50 dark:bg-slate-800 font-medium text-primary' : 'text-slate-700 dark:text-slate-300'
                ]"
              >
                <span class="size-2 rounded-full" :style="{ backgroundColor: cat.color }" aria-hidden="true"></span>
                {{ cat.name }}
              </button>
            </div>
          </div>
          
          <!-- Subtask count badge -->
          <span v-if="task.subtasks && task.subtasks.length > 0" class="flex items-center gap-1 text-slate-400">
             <span class="material-symbols-outlined text-[14px]">checklist</span>
             {{ task.subtasks.filter(s => s.is_completed).length }}/{{ task.subtasks.length }}
          </span>
        </div>
      </div>
    </div>

    <!-- Desktop Actions -->
    <div class="hidden sm:flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity self-center">
      <button 
        class="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50" 
        :aria-label="`Edit task: ${task.title}`"
        @click="emit('edit', task.id)"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
      </button>
      <button 
        @click="handleDeleteClick"
        class="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50" 
        :aria-label="`Delete task: ${task.title}`"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
      </button>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <ConfirmModal
    :is-open="showDeleteConfirm"
    title="Delete Task"
    :message="`Are you sure you want to delete '${task.title}'? This action cannot be undone.`"
    confirm-text="Delete"
    cancel-text="Cancel"
    variant="danger"
    icon="delete"
    @confirm="handleConfirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
