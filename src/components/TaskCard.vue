<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Task, CategoryOption, CategoryId } from '../types';
import ConfirmModal from './ConfirmModal.vue';
import { useHaptics } from '../composables/useHaptics';

const props = defineProps<{
  task: Task;
  categories: CategoryOption[];
}>();

const emit = defineEmits<{
  toggle: [];
  delete: [];
  edit: [id: string];
  share: [id: string];
  toggleSubtask: [taskId: string, subtaskId: string];
  deleteSubtask: [taskId: string, subtaskId: string];
  updateSubtaskTitle: [taskId: string, subtaskId: string, newTitle: string];
  updateCategory: [taskId: string, newCategory: CategoryId];
}>();

const { haptic } = useHaptics();

// Check if this is a shared task (not owned by current user)
const isSharedWithMe = computed(() => !!props.task.is_shared_with_me);

// Particle refs for completion celebration
const checkboxRef = ref<HTMLLabelElement | null>(null);
const particles = ref<{ id: number; x: number; y: number; color: string }[]>([]);

const isCategoryOpen = ref(false);
const isMenuOpen = ref(false);
const categoryMenuRef = ref<HTMLDivElement | null>(null);
const menuButtonRef = ref<HTMLDivElement | null>(null);
const showDeleteConfirm = ref(false);
const justCompleted = ref(false);
const isHovered = ref(false);

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

// Check if task has a reminder set
const hasReminder = computed(() => {
  return !!props.task.reminder_at && !props.task.reminder_sent;
});

// Format reminder time for display
const formattedReminderTime = computed(() => {
  if (!props.task.reminder_at) return '';
  const date = new Date(props.task.reminder_at);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
});

// Subtask progress
const subtaskProgress = computed(() => {
  if (!props.task.subtasks || props.task.subtasks.length === 0) return null;
  const completed = props.task.subtasks.filter(s => s.is_completed).length;
  const total = props.task.subtasks.length;
  return { completed, total, percentage: Math.round((completed / total) * 100) };
});

// Card accent color based on status
const accentColor = computed(() => {
  if (isOverdue.value) return '#ef4444'; // red
  if (isDueToday.value) return '#f59e0b'; // amber
  return currentCategory.value.color;
});

const categoryDropdownRef = ref<HTMLDivElement | null>(null);
const dropdownStyleFixed = ref<Record<string, string>>({});
const dropdownStyle = computed(() => dropdownStyleFixed.value);

const toggleCategoryMenu = () => {
  if (isCategoryOpen.value) {
    isCategoryOpen.value = false;
    return;
  }
  
  // Calculate position before showing
  if (categoryMenuRef.value) {
    const rect = categoryMenuRef.value.getBoundingClientRect();
    const spaceAbove = rect.top;
    
    // If we have enough space above (e.g. 200px), show above.
    // Otherwise show below.
    if (spaceAbove > 200) {
      dropdownStyleFixed.value = {
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: `${rect.left}px`,
        maxHeight: '200px'
      };
    } else {
      dropdownStyleFixed.value = {
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        maxHeight: '200px'
      };
    }
  }
  
  isCategoryOpen.value = true;
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;
  
  // Close category dropdown if click is outside both button and dropdown
  if (isCategoryOpen.value) {
    const clickedButton = categoryMenuRef.value?.contains(target);
    const clickedDropdown = categoryDropdownRef.value?.contains(target);
    if (!clickedButton && !clickedDropdown) {
      isCategoryOpen.value = false;
    }
  }

  if (menuButtonRef.value && !menuButtonRef.value.contains(target)) {
    isMenuOpen.value = false;
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (isCategoryOpen.value && event.key === 'Escape') {
    isCategoryOpen.value = false;
  }
  if (isMenuOpen.value && event.key === 'Escape') {
    isMenuOpen.value = false;
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
    haptic.success();
    createCompletionParticles();
    setTimeout(() => {
      justCompleted.value = false;
    }, 600);
  } else {
    haptic.light();
  }
  emit('toggle');
};

// Create celebration particles on task completion
const createCompletionParticles = () => {
  if (!checkboxRef.value) return;

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const newParticles = [];

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const distance = 25 + Math.random() * 15;
    newParticles.push({
      id: Date.now() + i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      color: colors[i % colors.length]
    });
  }

  particles.value = newParticles;
  setTimeout(() => {
    particles.value = [];
  }, 700);
};

const handleDeleteClick = () => {
  showDeleteConfirm.value = true;
  isMenuOpen.value = false;
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
    class="task-card group w-full"
    :class="{ 'task-card-completed': task.is_completed }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Category accent bar -->
    <div
      class="task-card-accent"
      :style="{ backgroundColor: accentColor }"
    />

    <div class="flex flex-col sm:flex-row sm:items-start p-4 pl-6 gap-3 relative z-10">
      <!-- Main content area -->
      <div class="flex items-start gap-4 flex-1 w-full min-w-0">

        <!-- Premium Checkbox -->
        <label
          ref="checkboxRef"
          class="relative flex items-center cursor-pointer shrink-0 group/check mt-0.5"
        >
          <input
            type="checkbox"
            :checked="task.is_completed"
            @change="handleToggle"
            class="sr-only"
            :aria-label="task.is_completed ? `Mark '${task.title}' as incomplete` : `Mark '${task.title}' as complete`"
          />
          <div
            class="task-checkbox"
            :class="{
              'checked': task.is_completed,
              'checkbox-ripple': justCompleted
            }"
          >
            <svg
              class="check-icon w-3.5 h-3.5"
              :class="{ 'opacity-100 scale-100': task.is_completed }"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke-linecap="round"
                stroke-linejoin="round"
                :class="justCompleted ? 'animate-draw-check' : ''"
                pathLength="1"
              />
            </svg>
          </div>

          <!-- Celebration particles -->
          <div
            v-for="particle in particles"
            :key="particle.id"
            class="completion-particle"
            :style="{
              '--tx': `${particle.x}px`,
              '--ty': `${particle.y}px`,
              backgroundColor: particle.color,
              left: '50%',
              top: '50%',
              marginLeft: '-4px',
              marginTop: '-4px'
            }"
          />
        </label>

        <!-- Task Content -->
        <div class="flex flex-col gap-2 w-full min-w-0">
          <!-- Title Row -->
          <div class="flex justify-between gap-3 min-w-0 relative">
            <span
              class="task-title-strike font-semibold text-[15px] leading-snug tracking-[-0.01em] break-words min-w-0 flex-1"
              :class="[
                task.is_completed
                  ? 'completed text-slate-400 dark:text-slate-500'
                  : 'text-slate-800 dark:text-slate-100'
              ]"
            >
              {{ task.title }}
            </span>

            <!-- Mobile Actions Menu Trigger -->
            <div class="sm:hidden relative shrink-0" ref="menuButtonRef">
              <button
                @click.stop="isMenuOpen = !isMenuOpen"
                class="task-action-btn size-8 -mr-1"
                :aria-label="`More options for ${task.title}`"
                :aria-expanded="isMenuOpen"
              >
                <span class="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
            </div>
          </div>

          <!-- Mobile Action Sheet (Portal to body) -->
          <Teleport to="body">
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="isMenuOpen"
                class="fixed inset-0 z-[100] sm:hidden"
                @click="isMenuOpen = false"
              >
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-slate-900/30" />

                <!-- Compact Action Sheet -->
                <div
                  class="absolute bottom-0 left-3 right-3 mb-3 flex flex-col gap-2 pb-safe"
                  @click.stop
                >
                  <!-- Main actions card -->
                  <div class="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl">
                    <!-- Task preview header -->
                    <div class="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50">
                      <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Task</p>
                      <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{{ task.title }}</p>
                    </div>

                    <!-- Action list -->
                    <div class="py-1">
                      <!-- Edit -->
                      <button
                        @click="isMenuOpen = false; emit('edit', task.id)"
                        class="w-full flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">edit</span>
                        <span class="text-[15px] font-medium text-slate-700 dark:text-slate-200">Edit Task</span>
                      </button>

                      <!-- Share -->
                      <button
                        v-if="!isSharedWithMe"
                        @click="isMenuOpen = false; emit('share', task.id)"
                        class="w-full flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">share</span>
                        <span class="text-[15px] font-medium text-slate-700 dark:text-slate-200">Share</span>
                      </button>

                      <!-- Mark complete/incomplete -->
                      <button
                        @click="isMenuOpen = false; handleToggle()"
                        class="w-full flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px]" :class="task.is_completed ? 'text-amber-500' : 'text-green-500'">
                          {{ task.is_completed ? 'replay' : 'check_circle' }}
                        </span>
                        <span class="text-[15px] font-medium text-slate-700 dark:text-slate-200">
                          {{ task.is_completed ? 'Mark Incomplete' : 'Mark Complete' }}
                        </span>
                      </button>

                      <!-- Delete (with separator) -->
                      <template v-if="!isSharedWithMe">
                        <div class="mx-4 border-t border-slate-100 dark:border-slate-700/50" />
                        <button
                          @click="handleDeleteClick"
                          class="w-full flex items-center gap-3 px-4 py-3 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                        >
                          <span class="material-symbols-outlined text-[20px] text-red-500">delete</span>
                          <span class="text-[15px] font-medium text-red-500">Move to Bin</span>
                        </button>
                      </template>
                    </div>
                  </div>

                  <!-- Cancel button (separate card) -->
                  <button
                    @click="isMenuOpen = false"
                    class="w-full py-3.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl text-primary font-semibold text-[15px] shadow-xl active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Transition>
          </Teleport>

          <!-- Subtasks -->
          <div v-if="task.subtasks && task.subtasks.length > 0" class="flex flex-col gap-1 mt-1" role="list" aria-label="Subtasks">
            <!-- Subtask Progress Bar -->
            <div v-if="subtaskProgress" class="flex items-center gap-2 mb-1">
              <div class="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out-expo"
                  :style="{ width: `${subtaskProgress.percentage}%` }"
                />
              </div>
              <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">
                {{ subtaskProgress.completed }}/{{ subtaskProgress.total }}
              </span>
            </div>

            <!-- Subtask Items -->
            <div
              v-for="subtask in task.subtasks"
              :key="subtask.id"
              class="subtask-item group/subtask"
              role="listitem"
            >
              <label class="relative flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  :checked="subtask.is_completed"
                  @change="emit('toggleSubtask', task.id, subtask.id)"
                  class="sr-only"
                  :aria-label="subtask.is_completed ? `Mark '${subtask.title}' as incomplete` : `Mark '${subtask.title}' as complete`"
                />
                <div
                  class="subtask-checkbox"
                  :class="{ 'checked': subtask.is_completed }"
                >
                  <svg v-if="subtask.is_completed" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
              </label>
              <input
                type="text"
                :value="subtask.title"
                @input="handleSubtaskTitleChange(subtask.id, $event)"
                :aria-label="`Edit subtask: ${subtask.title}`"
                :class="[
                  'flex-1 min-w-0 text-[13px] leading-tight bg-transparent border-none p-0 focus:ring-0 focus:outline-none cursor-text transition-colors',
                  subtask.is_completed
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-600 dark:text-slate-300'
                ]"
              />
              <button
                @click="emit('deleteSubtask', task.id, subtask.id)"
                class="ml-auto text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover/subtask:opacity-100 transition-all p-0.5"
                :aria-label="`Delete subtask: ${subtask.title}`"
              >
                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
              </button>
            </div>
          </div>

          <!-- Metadata Row -->
          <div class="flex flex-wrap items-center gap-1.5 mt-1">
            <!-- Overdue Badge -->
            <span
              v-if="isOverdue"
              class="task-badge task-badge-overdue badge-pop"
            >
              <span class="material-symbols-outlined text-[12px]">warning</span>
              Overdue
            </span>

            <!-- Today Badge -->
            <span
              v-else-if="isDueToday"
              class="task-badge task-badge-today badge-pop"
            >
              <span class="material-symbols-outlined text-[12px]">schedule</span>
              Today
            </span>

            <!-- Date Badge -->
            <span
              v-else-if="task.due_date && task.due_date !== 'No Due Date'"
              class="task-badge task-badge-date"
            >
              <span class="material-symbols-outlined text-[12px]">event</span>
              {{ task.due_date }}
            </span>

            <!-- Category Selector -->
            <div v-if="!isSharedWithMe" class="relative" ref="categoryMenuRef">
              <button
                @click="toggleCategoryMenu"
                :aria-expanded="isCategoryOpen"
                aria-haspopup="listbox"
                :aria-label="`Category: ${currentCategory.name}. Click to change.`"
                class="task-badge task-badge-category"
                :class="{ 'opacity-50': task.is_completed }"
              >
                <span
                  class="size-2 rounded-full ring-1 ring-inset ring-black/10"
                  :style="{ backgroundColor: currentCategory.color }"
                  aria-hidden="true"
                />
                <span class="font-medium">{{ currentCategory.name }}</span>
              </button>

              <!-- Category Dropdown (Teleported) -->
              <Teleport to="body">
                <Transition
                  enter-active-class="transition-all duration-200 ease-out-expo"
                  enter-from-class="opacity-0 scale-95 translate-y-1"
                  enter-to-class="opacity-100 scale-100 translate-y-0"
                  leave-active-class="transition-all duration-150"
                  leave-from-class="opacity-100 scale-100"
                  leave-to-class="opacity-0 scale-95"
                >
                  <div
                    v-if="isCategoryOpen"
                    ref="categoryDropdownRef"
                    role="listbox"
                    :aria-label="`Select category for ${task.title}`"
                    class="fixed w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[9999] py-1.5 flex flex-col overflow-hidden"
                    :style="dropdownStyle"
                  >
                    <button
                      v-for="cat in categories"
                      :key="cat.id"
                      role="option"
                      :aria-selected="task.category === cat.id"
                      @click="emit('updateCategory', task.id, cat.id); isCategoryOpen = false"
                      @keydown="handleCategoryKeydown($event, cat.id)"
                      :class="[
                        'flex items-center gap-3 px-3.5 py-2.5 text-[13px] text-left transition-colors duration-150',
                        'hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:bg-slate-50 dark:focus:bg-slate-700/50 focus:outline-none',
                        task.category === cat.id ? 'bg-primary/5 dark:bg-primary/10 font-semibold text-primary' : 'text-slate-700 dark:text-slate-300'
                      ]"
                    >
                      <span
                        class="size-3 rounded-full ring-1 ring-inset ring-black/10"
                        :style="{ backgroundColor: cat.color }"
                        aria-hidden="true"
                      />
                      {{ cat.name }}
                      <span
                        v-if="task.category === cat.id"
                        class="material-symbols-outlined text-[16px] ml-auto"
                      >
                        check
                      </span>
                    </button>
                  </div>
                </Transition>
              </Teleport>
            </div>

            <!-- Reminder Indicator -->
            <span
              v-if="hasReminder"
              class="task-badge"
              style="background: linear-gradient(135deg, hsl(270 80% 96%) 0%, hsl(270 80% 92%) 100%); color: hsl(270 60% 45%); border: 1px solid hsl(270 60% 85%);"
              :title="`Reminder: ${formattedReminderTime}`"
            >
              <span class="material-symbols-outlined text-[12px]">notifications</span>
              <span class="hidden sm:inline">{{ formattedReminderTime }}</span>
            </span>

            <!-- Shared Indicator -->
            <span
              v-if="isSharedWithMe"
              class="task-badge"
              style="background: linear-gradient(135deg, hsl(210 80% 96%) 0%, hsl(210 80% 92%) 100%); color: hsl(210 60% 45%); border: 1px solid hsl(210 60% 85%);"
              :title="task.shared_by ? `Shared by ${task.shared_by.name}` : 'Shared with you'"
            >
              <img
                v-if="task.shared_by?.avatar"
                :src="task.shared_by.avatar"
                :alt="task.shared_by.name"
                class="size-3.5 rounded-full object-cover -ml-0.5"
              />
              <span v-else class="material-symbols-outlined text-[12px]">person</span>
              <span class="max-w-[80px] truncate">{{ task.shared_by?.name || 'Shared' }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Desktop Actions -->
      <div
        class="hidden sm:flex items-center gap-1 ml-2 self-center transition-all duration-200"
        :class="isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'"
      >
        <button
          v-if="!isSharedWithMe"
          class="task-action-btn"
          :aria-label="`Share task: ${task.title}`"
          @click="emit('share', task.id)"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">share</span>
        </button>
        <button
          class="task-action-btn"
          :aria-label="`Edit task: ${task.title}`"
          @click="emit('edit', task.id)"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
        </button>
        <button
          v-if="!isSharedWithMe"
          @click="handleDeleteClick"
          class="task-action-btn danger"
          :aria-label="`Delete task: ${task.title}`"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <ConfirmModal
    :is-open="showDeleteConfirm"
    title="Move to Bin"
    :message="`Are you sure you want to move '${task.title}' to the bin? You can restore it later if you change your mind.`"
    confirm-text="Move to Bin"
    cancel-text="Cancel"
    variant="danger"
    icon="delete"
    @confirm="handleConfirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
