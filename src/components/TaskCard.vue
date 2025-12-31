<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { Task, Category } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { Category as CategoryEnum } from '../types';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  toggle: [];
  delete: [];
  edit: [id: string];
  toggleSubtask: [taskId: string, subtaskId: string];
  deleteSubtask: [taskId: string, subtaskId: string];
  updateSubtaskTitle: [taskId: string, subtaskId: string, newTitle: string];
  updateCategory: [taskId: string, newCategory: Category];
}>();

const isCategoryOpen = ref(false);
const categoryMenuRef = ref<HTMLDivElement | null>(null);

const categoryColor = CATEGORY_COLORS[props.task.category] || 'bg-slate-500';

const handleClickOutside = (event: MouseEvent) => {
  if (categoryMenuRef.value && !categoryMenuRef.value.contains(event.target as Node)) {
    isCategoryOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

const handleDeleteClick = () => {
  if (window.confirm('Are you sure you want to delete this task?')) {
    emit('delete');
  }
};

const handleSubtaskTitleChange = (subtaskId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('updateSubtaskTitle', props.task.id, subtaskId, target.value);
};
</script>

<template>
  <div 
    :class="[
      'group flex flex-col sm:flex-row sm:items-start p-4 rounded-xl border transition-all duration-200 ease-in-out',
      task.isCompleted 
        ? 'bg-slate-50 dark:bg-[#161f30] border-transparent hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100' 
        : `bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] ${isCategoryOpen ? 'z-20' : 'hover:z-10'}`
    ]"
  >
    <div class="flex items-start gap-4 flex-1 w-full">
      <!-- Checkbox -->
      <label class="relative flex items-center p-0 mt-1 cursor-pointer shrink-0">
        <input 
          type="checkbox" 
          :checked="task.isCompleted"
          @change="emit('toggle')"
          class="custom-checkbox peer sr-only" 
        />
        <div class="size-6 border-2 border-slate-300 dark:border-slate-500 rounded-md bg-transparent flex items-center justify-center transition-colors hover:border-primary">
          <svg v-if="task.isCompleted" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>
      </label>

      <div class="flex flex-col gap-1 w-full min-w-0">
        <div class="flex flex-wrap justify-between gap-2">
          <span :class="[
            'text-base font-semibold transition-colors decoration-2 truncate pr-2',
            task.isCompleted 
              ? 'line-through text-slate-500 dark:text-slate-400' 
              : 'text-slate-900 dark:text-white'
          ]">
            {{ task.title }}
          </span>
          
          <!-- Mobile Actions -->
          <span class="flex sm:hidden ml-auto gap-2 shrink-0">
             <button @click="emit('edit', task.id)" class="text-slate-400 hover:text-primary">
              <span class="material-symbols-outlined text-[20px]">edit</span>
             </button>
             <button @click="handleDeleteClick" class="text-slate-400 hover:text-red-500">
              <span class="material-symbols-outlined text-[20px]">delete</span>
             </button>
          </span>
        </div>
        
        <!-- Subtasks List -->
        <div v-if="task.subtasks && task.subtasks.length > 0" class="flex flex-col gap-2 mt-1 mb-2">
          <div v-for="subtask in task.subtasks" :key="subtask.id" class="flex items-center gap-2 group/subtask w-full">
            <label class="relative flex items-center p-0 cursor-pointer shrink-0">
                <input
                    type="checkbox"
                    :checked="subtask.isCompleted"
                    @change="emit('toggleSubtask', task.id, subtask.id)"
                    class="custom-checkbox peer sr-only"
                />
                <div :class="[
                  'size-4 border-2 rounded bg-transparent flex items-center justify-center transition-colors hover:border-primary',
                  subtask.isCompleted ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                ]">
                    <svg v-if="subtask.isCompleted" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </div>
            </label>
            <input
              type="text"
              :value="subtask.title"
              @input="handleSubtaskTitleChange(subtask.id, $event)"
              :class="[
                'flex-1 min-w-0 text-sm leading-tight bg-transparent border-none p-0 focus:ring-0 focus:outline-none cursor-text transition-colors',
                subtask.isCompleted 
                ? 'line-through text-slate-400 dark:text-slate-500' 
                : 'text-slate-600 dark:text-slate-300'
              ]"
            />
            <button 
              @click="emit('deleteSubtask', task.id, subtask.id)"
              class="ml-auto text-slate-400 hover:text-red-500 opacity-0 group-hover/subtask:opacity-100 transition-opacity p-0.5"
              title="Delete subtask"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-xs mt-1">
          <!-- Due Date Badge -->
          <span :class="['flex items-center gap-1 font-medium px-2 py-0.5 rounded', task.dueDateBg || '', task.dueDateColor || 'text-slate-500']">
            <span class="material-symbols-outlined text-[14px]">{{ task.dueDateIcon || 'calendar_today' }}</span>
            {{ task.dueDate }}
          </span>

          <!-- Category Badge -->
          <div class="relative" ref="categoryMenuRef">
            <button
              @click="isCategoryOpen = !isCategoryOpen"
              :class="[
                'flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 -ml-1.5 transition-colors',
                task.isCompleted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
              ]"
              title="Change Category"
            >
              <span :class="['size-2 rounded-full', categoryColor, task.isCompleted ? 'opacity-50' : '']"></span>
              {{ task.category }}
            </button>

            <div
              v-if="isCategoryOpen"
              class="absolute bottom-full mb-1 left-0 w-32 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col overflow-hidden"
            >
              <button
                v-for="cat in Object.values(CategoryEnum)"
                :key="cat"
                @click="emit('updateCategory', task.id, cat); isCategoryOpen = false"
                :class="[
                  'flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  task.category === cat ? 'bg-slate-50 dark:bg-slate-800 font-medium text-primary' : 'text-slate-700 dark:text-slate-300'
                ]"
              >
                <span :class="['size-2 rounded-full', CATEGORY_COLORS[cat]]"></span>
                {{ cat }}
              </button>
            </div>
          </div>
          
          <!-- Subtask count badge -->
          <span v-if="task.subtasks && task.subtasks.length > 0" class="flex items-center gap-1 text-slate-400">
             <span class="material-symbols-outlined text-[14px]">checklist</span>
             {{ task.subtasks.filter(s => s.isCompleted).length }}/{{ task.subtasks.length }}
          </span>
        </div>
      </div>
    </div>

    <!-- Desktop Actions -->
    <div class="hidden sm:flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity self-center">
      <button 
        class="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-primary transition-colors" 
        title="Edit"
        @click="emit('edit', task.id)"
      >
        <span class="material-symbols-outlined text-[20px]">edit</span>
      </button>
      <button 
        @click="handleDeleteClick"
        class="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-red-500 transition-colors" 
        title="Delete"
      >
        <span class="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  </div>
</template>
