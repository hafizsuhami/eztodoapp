<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Task, CategoryOption } from '../types';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  tasks: Task[];
  categories: CategoryOption[];
  groupLabel: string;
  groupIcon: string;
  groupColor: string;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  toggleSubtask: [taskId: string, subtaskId: string];
  delete: [id: string];
  deleteSubtask: [taskId: string, subtaskId: string];
  edit: [id: string];
  share: [id: string];
  updateSubtaskTitle: [taskId: string, subtaskId: string, title: string];
  updateCategory: [taskId: string, categoryId: string];
  reorderTasks: [tasks: Task[]];
}>();

// Local copy for drag-and-drop
const localTasks = ref<Task[]>([]);

// Drag and drop state (must be defined before watch that uses them)
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// Touch drag state
const touchStartY = ref<number>(0);
const touchCurrentY = ref<number>(0);
const isTouchDragging = ref(false);
const taskElements = ref<HTMLElement[]>([]);

// Sync with props
watch(() => props.tasks, (newTasks) => {
  if (draggedIndex.value === null) {
    localTasks.value = [...newTasks];
  }
}, { immediate: true, deep: true });

// Desktop drag and drop handlers
const handleDragStart = (index: number, event: DragEvent) => {
  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }
};

const handleDragOver = (index: number, event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dragOverIndex.value = index;
  }
};

const handleDragLeave = () => {
  dragOverIndex.value = null;
};

const handleDrop = (dropIndex: number, event: DragEvent) => {
  event.preventDefault();
  performReorder(dropIndex);
};

const handleDragEnd = () => {
  draggedIndex.value = null;
  dragOverIndex.value = null;
};

// Touch handlers for mobile
const handleTouchStart = (index: number, event: TouchEvent) => {
  const touch = event.touches[0];
  touchStartY.value = touch.clientY;
  touchCurrentY.value = touch.clientY;
  draggedIndex.value = index;
  isTouchDragging.value = true;
  
  // Collect task elements for hit testing
  const container = (event.target as HTMLElement).closest('.task-group-container');
  if (container) {
    taskElements.value = Array.from(container.querySelectorAll('.task-item'));
  }
};

const handleTouchMove = (event: TouchEvent) => {
  if (!isTouchDragging.value || draggedIndex.value === null) return;
  
  event.preventDefault();
  const touch = event.touches[0];
  touchCurrentY.value = touch.clientY;
  
  // Find which element we're over
  const overIndex = taskElements.value.findIndex(el => {
    const rect = el.getBoundingClientRect();
    return touch.clientY >= rect.top && touch.clientY <= rect.bottom;
  });
  
  if (overIndex !== -1 && overIndex !== draggedIndex.value) {
    dragOverIndex.value = overIndex;
  }
};

const handleTouchEnd = () => {
  if (!isTouchDragging.value) return;
  
  if (dragOverIndex.value !== null && dragOverIndex.value !== draggedIndex.value) {
    performReorder(dragOverIndex.value);
  }
  
  // Reset touch state
  isTouchDragging.value = false;
  draggedIndex.value = null;
  dragOverIndex.value = null;
  touchStartY.value = 0;
  touchCurrentY.value = 0;
  taskElements.value = [];
};

// Shared reorder logic
const performReorder = (dropIndex: number) => {
  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  const newTasks = [...localTasks.value];
  const [draggedItem] = newTasks.splice(draggedIndex.value, 1);
  newTasks.splice(dropIndex, 0, draggedItem);

  localTasks.value = newTasks;
  emit('reorderTasks', newTasks);

  draggedIndex.value = null;
  dragOverIndex.value = null;
};

// Compute drag offset for touch dragging
const getDragStyle = (index: number) => {
  if (!isTouchDragging.value || draggedIndex.value !== index) return {};
  const offset = touchCurrentY.value - touchStartY.value;
  return {
    transform: `translateY(${offset}px)`,
    zIndex: 50,
    position: 'relative' as const
  };
};
</script>

<template>
  <div class="flex flex-col gap-3 task-group-container">
    <!-- Section Header -->
    <div v-if="groupLabel" class="flex items-center gap-2 pt-2">
      <span :class="['material-symbols-outlined text-[18px]', groupColor]" aria-hidden="true">{{ groupIcon }}</span>
      <h3 :class="['text-sm font-semibold', groupColor]">{{ groupLabel }}</h3>
      <span class="text-xs text-slate-400 dark:text-slate-500">({{ localTasks.length }})</span>
      <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700 ml-2"></div>
    </div>
    
    <!-- Tasks in group -->
    <div
      v-for="(task, index) in localTasks"
      :key="task.id"
      class="task-item flex items-center transition-all duration-200"
      :class="{
        'opacity-50 scale-[0.98]': draggedIndex === index && !isTouchDragging,
        'shadow-lg': draggedIndex === index && isTouchDragging,
      }"
      :style="getDragStyle(index)"
    >
      <!-- Drag handle - separate from card -->
      <div 
        draggable="true"
        @dragstart="handleDragStart(index, $event)"
        @dragover.prevent="handleDragOver(index, $event)"
        @drop="handleDrop(index, $event)"
        @dragend="handleDragEnd"
        @touchstart.stop.passive="handleTouchStart(index, $event)"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        class="shrink-0 w-6 h-full flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors touch-none mr-1"
        title="Drag to reorder"
      >
        <span class="material-symbols-outlined text-[18px]">drag_indicator</span>
      </div>
      
      <!-- Drop indicator line -->
      <div 
        v-if="dragOverIndex === index && draggedIndex !== index"
        class="absolute -top-1.5 left-0 right-0 h-0.5 bg-primary rounded-full z-10"
      />
      
      <!-- Task card takes remaining space -->
      <div 
        class="flex-1 min-w-0"
        @dragover.prevent="handleDragOver(index, $event)"
        @drop="handleDrop(index, $event)"
      >
        <TaskCard
          :task="task"
          :categories="categories"
          @toggle="emit('toggle', task.id)"
          @toggle-subtask="emit('toggleSubtask', task.id, $event)"
          @delete="emit('delete', task.id)"
          @delete-subtask="(taskId, subtaskId) => emit('deleteSubtask', taskId, subtaskId)"
          @edit="emit('edit', task.id)"
          @share="emit('share', task.id)"
          @update-subtask-title="(taskId, subtaskId, title) => emit('updateSubtaskTitle', taskId, subtaskId, title)"
          @update-category="(taskId, catId) => emit('updateCategory', taskId, catId)"
        />
      </div>
    </div>
  </div>
</template>
