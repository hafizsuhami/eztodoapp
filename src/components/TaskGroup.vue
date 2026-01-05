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

// Swipe-to-delete state
const swipeStartX = ref<number>(0);
const swipeCurrentX = ref<number>(0);
const swipingTaskIndex = ref<number | null>(null);
const isSwipingHorizontal = ref<boolean | null>(null);
const SWIPE_THRESHOLD = 80; // pixels to trigger delete
const DELETE_BUTTON_WIDTH = 80; // width of delete button

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

// Swipe-to-delete handlers
const handleSwipeStart = (index: number, event: TouchEvent) => {
  // Don't start swipe if on shared task (can't delete)
  const task = localTasks.value[index];
  if (task.is_shared_with_me) return;
  
  const touch = event.touches[0];
  swipeStartX.value = touch.clientX;
  swipeCurrentX.value = touch.clientX;
  swipingTaskIndex.value = index;
  isSwipingHorizontal.value = null; // Will be determined during move
};

const handleSwipeMove = (event: TouchEvent) => {
  if (swipingTaskIndex.value === null) return;
  
  const touch = event.touches[0];
  const deltaX = touch.clientX - swipeStartX.value;
  const deltaY = Math.abs(touch.clientY - touchStartY.value);
  
  // Determine direction if not yet set (first significant move)
  if (isSwipingHorizontal.value === null) {
    const absDeltaX = Math.abs(deltaX);
    if (absDeltaX > 10 || deltaY > 10) {
      isSwipingHorizontal.value = absDeltaX > deltaY;
    }
  }
  
  // Only handle horizontal swipes (left swipe = negative delta)
  if (isSwipingHorizontal.value && deltaX < 0) {
    event.preventDefault(); // Prevent scroll when swiping
    swipeCurrentX.value = touch.clientX;
  }
};

const handleSwipeEnd = () => {
  if (swipingTaskIndex.value === null) return;
  
  const deltaX = swipeCurrentX.value - swipeStartX.value;
  
  // If swiped past threshold, trigger delete
  if (isSwipingHorizontal.value && deltaX < -SWIPE_THRESHOLD) {
    const task = localTasks.value[swipingTaskIndex.value];
    if (task && !task.is_shared_with_me) {
      emit('delete', task.id);
    }
  }
  
  // Reset swipe state
  resetSwipeState();
};

const resetSwipeState = () => {
  swipeStartX.value = 0;
  swipeCurrentX.value = 0;
  swipingTaskIndex.value = null;
  isSwipingHorizontal.value = null;
};

// Get swipe transform style
const getSwipeStyle = (index: number) => {
  if (swipingTaskIndex.value !== index || !isSwipingHorizontal.value) return {};
  
  const deltaX = swipeCurrentX.value - swipeStartX.value;
  // Only allow left swipe (negative), clamp at delete button width
  const clampedDelta = Math.max(Math.min(deltaX, 0), -DELETE_BUTTON_WIDTH);
  
  return {
    transform: `translateX(${clampedDelta}px)`,
    transition: 'none'
  };
};

// Check if delete action should show
const isSwipingTask = (index: number) => {
  return swipingTaskIndex.value === index && isSwipingHorizontal.value;
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
      class="task-item relative overflow-hidden rounded-xl"
      :class="{
        'opacity-50 scale-[0.98]': draggedIndex === index && !isTouchDragging,
        'shadow-lg': draggedIndex === index && isTouchDragging,
      }"
      :style="getDragStyle(index)"
    >
      <!-- Delete action background (revealed when swiping) -->
      <div 
        v-if="!task.is_shared_with_me"
        class="absolute inset-y-0 right-0 flex items-center justify-end bg-gradient-to-l from-red-500 to-red-600 transition-opacity"
        :class="isSwipingTask(index) ? 'opacity-100' : 'opacity-0'"
        :style="{ width: DELETE_BUTTON_WIDTH + 'px' }"
      >
        <div class="flex flex-col items-center justify-center w-full h-full text-white">
          <span class="material-symbols-outlined text-[24px]">delete</span>
          <span class="text-xs font-medium mt-0.5">Delete</span>
        </div>
      </div>
      
      <!-- Swipeable content container -->
      <div 
        class="flex items-center bg-white dark:bg-[#1e293b] transition-transform"
        :style="getSwipeStyle(index)"
        @touchstart.passive="handleSwipeStart(index, $event)"
        @touchmove="handleSwipeMove"
        @touchend="handleSwipeEnd"
        @touchcancel="resetSwipeState"
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
  </div>
</template>
