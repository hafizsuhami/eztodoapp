<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Task, CategoryOption } from '../types';
import TaskCard from './TaskCard.vue';
import { useHaptics } from '../composables/useHaptics';

const { haptic } = useHaptics();

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
const swipeStartTime = ref<number>(0);
const SWIPE_THRESHOLD = 100; // pixels to trigger delete
const VELOCITY_THRESHOLD = 0.5; // pixels per ms
const DELETE_BUTTON_WIDTH = 100; // width of delete button
const MAX_SWIPE = 120; // max rubber-band limit
const swipeTriggeredHaptic = ref(false);

// Sync with props
watch(() => props.tasks, (newTasks) => {
  if (draggedIndex.value === null) {
    localTasks.value = [...newTasks];
  }
}, { immediate: true, deep: true });

// Desktop drag and drop handlers
const handleDragStart = (index: number, event: DragEvent) => {
  draggedIndex.value = index;
  haptic.drag();
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

  haptic.medium();

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
  swipeStartTime.value = Date.now();
  isSwipingHorizontal.value = null;
  swipeTriggeredHaptic.value = false;
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
    event.preventDefault();
    swipeCurrentX.value = touch.clientX;

    // Trigger haptic when passing threshold
    if (!swipeTriggeredHaptic.value && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      haptic.swipeThreshold();
      swipeTriggeredHaptic.value = true;
    }
  }
};

const handleSwipeEnd = () => {
  if (swipingTaskIndex.value === null) return;

  const deltaX = swipeCurrentX.value - swipeStartX.value;
  const deltaTime = Date.now() - swipeStartTime.value;
  const velocity = Math.abs(deltaX) / deltaTime;

  // Trigger delete on threshold OR velocity
  if (isSwipingHorizontal.value && (deltaX < -SWIPE_THRESHOLD || (deltaX < -50 && velocity > VELOCITY_THRESHOLD))) {
    const task = localTasks.value[swipingTaskIndex.value];
    if (task && !task.is_shared_with_me) {
      haptic.heavy();
      emit('delete', task.id);
    }
  }

  resetSwipeState();
};

const resetSwipeState = () => {
  swipeStartX.value = 0;
  swipeCurrentX.value = 0;
  swipingTaskIndex.value = null;
  isSwipingHorizontal.value = null;
  swipeStartTime.value = 0;
  swipeTriggeredHaptic.value = false;
};

// Get swipe transform style with rubber-band effect
const getSwipeStyle = (index: number) => {
  if (swipingTaskIndex.value !== index || !isSwipingHorizontal.value) return {};

  const deltaX = swipeCurrentX.value - swipeStartX.value;

  // Rubber-band effect: past MAX_SWIPE, slow down the movement
  let transformX: number;
  if (deltaX < -MAX_SWIPE) {
    // Rubber-band: only 20% of movement past threshold
    transformX = -MAX_SWIPE + (deltaX + MAX_SWIPE) * 0.2;
  } else {
    transformX = Math.max(deltaX, -MAX_SWIPE);
  }

  return {
    transform: `translateX(${transformX}px)`,
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
      <div class="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent ml-2" />
    </div>

    <!-- Tasks in group with TransitionGroup for animations -->
    <TransitionGroup
      tag="div"
      class="flex flex-col gap-3"
      enter-active-class="transition-all duration-300 ease-out-expo"
      enter-from-class="opacity-0 translate-y-2 scale-[0.98]"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-8 scale-[0.95]"
      move-class="transition-all duration-300 ease-out-expo"
    >
      <div
        v-for="(task, index) in localTasks"
        :key="task.id"
        class="task-item relative overflow-hidden rounded-xl"
        :class="{
          'opacity-50 scale-[0.98]': draggedIndex === index && !isTouchDragging,
          'shadow-lg ring-2 ring-primary/20': draggedIndex === index && isTouchDragging,
        }"
        :style="{ ...getDragStyle(index), '--stagger-delay': `${index * 50}ms` }"
      >
        <!-- Delete action background (revealed when swiping) -->
        <div
          v-if="!task.is_shared_with_me"
          class="absolute inset-y-0 right-0 flex items-center justify-center bg-gradient-to-l from-red-500 via-red-500 to-red-600 transition-all duration-150"
          :class="isSwipingTask(index) ? 'opacity-100' : 'opacity-0'"
          :style="{ width: DELETE_BUTTON_WIDTH + 'px' }"
        >
          <div class="flex flex-col items-center justify-center text-white">
            <span class="material-symbols-outlined text-[28px]">delete</span>
            <span class="text-xs font-semibold mt-1">Delete</span>
          </div>
        </div>

        <!-- Swipeable content container -->
        <div
          class="flex items-center bg-white dark:bg-slate-800/80 rounded-xl"
          :class="{ 'transition-transform duration-200 ease-out': swipingTaskIndex !== index }"
          :style="getSwipeStyle(index)"
          @touchstart.passive="handleSwipeStart(index, $event)"
          @touchmove="handleSwipeMove"
          @touchend="handleSwipeEnd"
          @touchcancel="resetSwipeState"
        >
          <!-- Drag handle -->
          <div
            draggable="true"
            @dragstart="handleDragStart(index, $event)"
            @dragover.prevent="handleDragOver(index, $event)"
            @drop="handleDrop(index, $event)"
            @dragend="handleDragEnd"
            @touchstart.stop.passive="handleTouchStart(index, $event)"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            class="shrink-0 w-7 h-full flex items-center justify-center cursor-grab active:cursor-grabbing
              text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400
              active:text-primary transition-colors touch-none"
            title="Drag to reorder"
          >
            <span class="material-symbols-outlined text-[20px]">drag_indicator</span>
          </div>

          <!-- Drop indicator line -->
          <Transition
            enter-active-class="transition-all duration-150"
            enter-from-class="opacity-0 scale-x-0"
            enter-to-class="opacity-100 scale-x-100"
            leave-active-class="transition-all duration-100"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="dragOverIndex === index && draggedIndex !== index"
              class="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full z-10 shadow-primary-sm"
            />
          </Transition>

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
              @toggle-subtask="(taskId, subtaskId) => emit('toggleSubtask', taskId, subtaskId)"
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
    </TransitionGroup>
  </div>
</template>
