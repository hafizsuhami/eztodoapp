<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import Header from './components/Header.vue';
import TaskCard from './components/TaskCard.vue';
import AddTaskModal from './components/AddTaskModal.vue';
import EditTaskModal from './components/EditTaskModal.vue';
import LoginModal from './components/LoginModal.vue';
import LandingPage from './components/LandingPage.vue';
import CategoryManagerModal from './components/CategoryManagerModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import ToastContainer from './components/ToastContainer.vue';
import { type TaskStatus, type Subtask, type CategoryId, type Task } from './types';
import { useAuth } from './composables/useAuth';
import { useTasks } from './composables/useTasks';
import { useCategories } from './composables/useCategories';
import { useToast } from './composables/useToast';

// Auth composable
const { user, loading: authLoading, isAuthenticated, loginWithGoogle, logout } = useAuth();

// Toast notifications
const toast = useToast();

// Tasks composable - reactive to user.value.id
const getUserId = () => user.value?.id;
const {
  tasks,
  loading: tasksLoading,
  syncStatus,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  updateTaskCategory,
  updateSubtasks
} = useTasks(getUserId);

// Categories composable
const {
  categories,
  loading: categoriesLoading,
  getCategoryById,
  createCategory,
  updateCategory: updateCategoryFn,
  deleteCategory: deleteCategoryFn
} = useCategories(getUserId);

// Local state
const activeTab = ref<TaskStatus>('active');
const searchQuery = ref('');
const categoryFilter = ref<CategoryId | null>(null);
const isAddModalOpen = ref(false);
const isCategoryManagerOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Quick add state
const quickAddTitle = ref('');
const isQuickAddFocused = ref(false);

// Edit task modal state
const isEditModalOpen = ref(false);
const taskToEdit = ref<Task | null>(null);

// Subtask delete confirmation state
const showSubtaskDeleteConfirm = ref(false);
const subtaskToDelete = ref<{ taskId: string; subtaskId: string; title: string } | null>(null);

// Recently deleted task for undo
const recentlyDeletedTask = ref<Task | null>(null);

// Computed values
const activeCount = computed(() => tasks.value.filter(t => !t.is_completed).length);
const completedCount = computed(() => tasks.value.filter(t => t.is_completed).length);

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // 1. Status Filter
    if (activeTab.value === 'active' && task.is_completed) return false;
    if (activeTab.value === 'completed' && !task.is_completed) return false;

    // 2. Category Filter
    if (categoryFilter.value && task.category !== categoryFilter.value) return false;

    // 3. Search Filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const cat = getCategoryById(task.category);
      const catName = cat?.name?.toLowerCase() || '';
      return task.title.toLowerCase().includes(query) ||
             catName.includes(query) ||
             task.subtasks?.some(s => s.title.toLowerCase().includes(query));
    }

    return true;
  });
});

// Greeting helpers
const greetingMessage = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
});

const currentDate = computed(() => {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const day = now.toLocaleDateString('en-US', { day: '2-digit' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const year = now.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
});

// Get user's first name for greeting
const firstName = computed(() => user.value?.name?.split(' ')[0] || 'there');

// Tab options
const tabOptions: TaskStatus[] = ['all', 'active', 'completed'];

// Keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  // Ignore if user is typing in an input
  const target = event.target as HTMLElement;
  const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  
  // Escape closes modals
  if (event.key === 'Escape') {
    if (isAddModalOpen.value) {
      isAddModalOpen.value = false;
      return;
    }
    if (isEditModalOpen.value) {
      isEditModalOpen.value = false;
      taskToEdit.value = null;
      return;
    }
    if (isCategoryManagerOpen.value) {
      isCategoryManagerOpen.value = false;
      return;
    }
  }
  
  if (isInputFocused) return;
  
  // 'n' - New task
  if (event.key === 'n' && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    isAddModalOpen.value = true;
  }
  
  // '/' - Focus search
  if (event.key === '/') {
    event.preventDefault();
    searchInputRef.value?.focus();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});

// Handlers
const handleToggleTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    toggleTask(id, task.is_completed);
    if (!task.is_completed) {
      toast.success('Task completed!');
    }
  }
};

const handleToggleSubtask = (taskId: string, subtaskId: string) => {
  const task = tasks.value.find(t => t.id === taskId);
  if (task && task.subtasks) {
    const updatedSubtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
    );
    updateSubtasks(taskId, updatedSubtasks);
  }
};

const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
  const task = tasks.value.find(t => t.id === taskId);
  if (task && task.subtasks) {
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtaskToDelete.value = { taskId, subtaskId, title: subtask.title };
      showSubtaskDeleteConfirm.value = true;
    }
  }
};

const handleConfirmSubtaskDelete = () => {
  if (subtaskToDelete.value) {
    const task = tasks.value.find(t => t.id === subtaskToDelete.value!.taskId);
    if (task && task.subtasks) {
      const updatedSubtasks = task.subtasks.filter(s => s.id !== subtaskToDelete.value!.subtaskId);
      updateSubtasks(subtaskToDelete.value.taskId, updatedSubtasks);
    }
  }
  showSubtaskDeleteConfirm.value = false;
  subtaskToDelete.value = null;
};

const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, newTitle: string) => {
  const task = tasks.value.find(t => t.id === taskId);
  if (task && task.subtasks) {
    const updatedSubtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, title: newTitle } : s
    );
    updateSubtasks(taskId, updatedSubtasks);
  }
};

const handleUpdateTaskCategory = (taskId: string, newCategory: CategoryId) => {
  updateTaskCategory(taskId, newCategory);
  const cat = getCategoryById(newCategory);
  if (cat) {
    toast.info(`Moved to ${cat.name}`);
  }
};

const handleDeleteTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    recentlyDeletedTask.value = { ...task };
    deleteTask(id);
    toast.success('Task deleted', {
      duration: 5000,
      action: {
        label: 'Undo',
        handler: () => handleUndoDelete()
      }
    });
  }
};

const handleUndoDelete = () => {
  if (recentlyDeletedTask.value) {
    const task = recentlyDeletedTask.value;
    createTask({
      title: task.title,
      is_completed: task.is_completed,
      category: task.category,
      due_date: task.due_date,
      due_date_color: task.due_date_color,
      due_date_bg: task.due_date_bg,
      due_date_icon: task.due_date_icon,
      subtasks: task.subtasks
    });
    recentlyDeletedTask.value = null;
    toast.success('Task restored');
  }
};

const handleEditTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    taskToEdit.value = task;
    isEditModalOpen.value = true;
  }
};

const handleSaveEditedTask = (
  taskId: string,
  title: string,
  subtasks: Subtask[],
  category: CategoryId,
  dueDate: string
) => {
  updateTask(taskId, {
    title,
    subtasks,
    category,
    due_date: dueDate
  });
  isEditModalOpen.value = false;
  taskToEdit.value = null;
  toast.success('Task updated');
};

const handleCloseEditModal = () => {
  isEditModalOpen.value = false;
  taskToEdit.value = null;
};

const handleSaveNewTask = (title: string, subtaskTitles: string[], category: CategoryId, dueDate: string) => {
  const subtasks: Subtask[] = subtaskTitles.map(s => ({
    id: Date.now().toString() + Math.random().toString(),
    title: s,
    is_completed: false
  }));

  createTask({
    title,
    is_completed: false,
    category,
    due_date: dueDate || 'No Due Date',
    due_date_color: 'text-slate-500',
    subtasks
  });
  toast.success('Task created');
};

// Quick add handler
const handleQuickAdd = () => {
  if (!quickAddTitle.value.trim()) return;
  
  const defaultCategory = categories.value[0]?.id || '';
  createTask({
    title: quickAddTitle.value.trim(),
    is_completed: false,
    category: defaultCategory,
    due_date: 'No Due Date',
    due_date_color: 'text-slate-500',
    subtasks: []
  });
  
  quickAddTitle.value = '';
  toast.success('Task created');
};

const handleQuickAddKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleQuickAdd();
  }
};

const clearFilters = () => {
  categoryFilter.value = null;
  searchQuery.value = '';
  activeTab.value = 'all';
};

const hasActiveFilters = computed(() => {
  return categoryFilter.value || searchQuery.value || activeTab.value !== 'all';
});

// Category task counts for progress indicator
const getCategoryTaskCount = (catId: string) => {
  const catTasks = tasks.value.filter(t => t.category === catId);
  const completed = catTasks.filter(t => t.is_completed).length;
  return { total: catTasks.length, completed };
};
</script>

<template>
  <!-- Loading State -->
  <div v-if="authLoading" class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#111722]">
    <div class="flex flex-col items-center gap-4">
      <span class="material-symbols-outlined text-4xl text-primary animate-spin">
        progress_activity
      </span>
      <p class="text-slate-500 dark:text-slate-400">Loading...</p>
    </div>
  </div>

  <!-- Landing Page for non-authenticated users -->
  <LandingPage 
    v-else-if="!isAuthenticated" 
    @get-started="loginWithGoogle" 
  />

  <!-- Main App for authenticated users -->
  <template v-else>
    <Header :user="user" :sync-status="syncStatus" @logout="logout" />

    <main class="flex flex-1 justify-center py-6 px-4 md:px-8">
        <div class="flex flex-col max-w-[800px] w-full gap-6">

          <!-- Heading & Summary -->
          <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
            <div class="flex flex-col gap-3 w-full">
              <div class="flex flex-col items-center text-center gap-2">
                <span class="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-[#1e293b] px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">calendar_today</span>
                  {{ currentDate }}
                </span>
                <h1 class="text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white">
                  {{ greetingMessage }}, {{ firstName }}
                </h1>
                <p class="text-slate-500 dark:text-[#92a4c9] text-base font-medium">
                  You have {{ activeCount }} active task{{ activeCount !== 1 ? 's' : '' }} today
                </p>
              </div>
            </div>
            <button
              @click="isAddModalOpen = true"
              class="hidden md:flex items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary hover:bg-primary/90 transition-all active:scale-95 text-white text-base font-bold shadow-lg shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              aria-label="Add new task"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              <span class="truncate">Add New Task</span>
            </button>
          </div>

          <!-- Quick Add Input -->
          <div class="relative hidden sm:block">
            <div 
              :class="[
                'flex items-center gap-3 bg-white dark:bg-[#1e293b] border rounded-xl px-4 py-3 transition-all',
                isQuickAddFocused 
                  ? 'border-primary shadow-lg shadow-primary/10' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              ]"
            >
              <span class="material-symbols-outlined text-[20px] text-slate-400" aria-hidden="true">add_task</span>
              <input
                v-model="quickAddTitle"
                type="text"
                placeholder="Quick add a task... (press 'n' for full editor)"
                @keydown="handleQuickAddKeydown"
                @focus="isQuickAddFocused = true"
                @blur="isQuickAddFocused = false"
                class="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 text-sm"
                aria-label="Quick add task"
              />
              <button
                v-if="quickAddTitle.trim()"
                @click="handleQuickAdd"
                class="shrink-0 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                Add
              </button>
              <kbd 
                v-else
                class="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded"
                aria-hidden="true"
              >
                Enter
              </kbd>
            </div>
          </div>


        <!-- Mobile FAB (Floating Action Button) -->
        <button
          @click="isAddModalOpen = true"
          class="md:hidden fixed bottom-6 right-6 z-40 size-14 flex items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary/90 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Add new task"
        >
          <span class="material-symbols-outlined text-[28px]" aria-hidden="true">add</span>
        </button>

        <!-- Loading State for Tasks -->
        <div v-if="tasksLoading && tasks.length === 0" class="flex justify-center py-12">
          <span class="material-symbols-outlined text-4xl text-primary animate-spin">
            progress_activity
          </span>
        </div>

        <!-- Filters & Search -->
        <div v-if="!tasksLoading" class="flex flex-col gap-4">
          <!-- Top Filter Row: Tabs & Search -->
          <div class="flex flex-col sm:flex-row justify-between items-center border-b border-slate-200 dark:border-[#324467] gap-4">

            <!-- Tabs -->
            <div class="flex w-full sm:w-auto overflow-x-auto no-scrollbar gap-8 px-2">
              <button
                v-for="tab in tabOptions"
                :key="tab"
                @click="activeTab = tab"
                :class="[
                  'group flex flex-col items-center justify-center border-b-[3px] pb-3 transition-colors cursor-pointer min-w-[60px]',
                  activeTab === tab
                    ? 'border-b-primary text-primary dark:text-white'
                    : 'border-b-transparent text-slate-500 dark:text-[#92a4c9] hover:text-primary'
                ]"
              >
                <p class="text-sm font-bold leading-normal tracking-[0.015em] capitalize">
                  {{ tab }}
                </p>
              </button>
            </div>

            <!-- Search -->
            <div class="flex items-center gap-2 pb-2 w-full sm:w-auto">
              <div class="relative flex-1 sm:w-64">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]" aria-hidden="true">
                  search
                </span>
                <input
                  ref="searchInputRef"
                  type="text"
                  v-model="searchQuery"
                  class="w-full bg-slate-100 dark:bg-[#1e293b] text-slate-900 dark:text-white text-sm rounded-lg pl-10 pr-8 sm:pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-primary border-none placeholder-slate-400 transition-shadow"
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                />
                <kbd 
                  class="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 text-xs font-medium text-slate-400 bg-slate-200 dark:bg-slate-700 rounded"
                  aria-hidden="true"
                >
                  /
                </kbd>
              </div>
            </div>
          </div>

          <!-- Chips (Categories) -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                Filter by:
              </span>
              <div class="flex items-center gap-3">
                <button
                  v-if="hasActiveFilters"
                  @click="clearFilters"
                  class="text-xs text-primary hover:underline font-medium"
                >
                  Clear all
                </button>
                <button
                  @click="isCategoryManagerOpen = true"
                  class="text-xs text-primary hover:underline font-medium"
                  aria-label="Manage categories"
                >
                  Manage
                </button>
              </div>
            </div>
            <div class="flex gap-2 flex-wrap items-center" role="group" aria-label="Category filters">
              <button
                v-for="cat in categories"
                :key="cat.id"
                @click="categoryFilter = categoryFilter === cat.id ? null : cat.id"
                :aria-pressed="categoryFilter === cat.id"
                :class="[
                  'flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg pl-3 pr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                  categoryFilter === cat.id
                    ? 'bg-slate-200 dark:bg-[#2d3b55] text-slate-800 dark:text-white'
                    : 'border border-slate-200 dark:border-[#232f48] hover:bg-slate-100 dark:hover:bg-[#1e293b] text-slate-500 dark:text-[#92a4c9]'
                ]"
              >
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: cat.color }" aria-hidden="true"></span>
                <p class="text-sm font-medium leading-normal">{{ cat.name }}</p>
                <span 
                  v-if="getCategoryTaskCount(cat.id).total > 0"
                  class="text-xs text-slate-400 dark:text-slate-500"
                >
                  {{ getCategoryTaskCount(cat.id).completed }}/{{ getCategoryTaskCount(cat.id).total }}
                </span>
                <span
                  v-if="categoryFilter === cat.id"
                  class="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[18px]"
                  aria-hidden="true"
                >
                  close
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Task List Container -->
        <div class="flex flex-col gap-3 pb-20" role="list" aria-label="Task list">
          <!-- Empty State -->
          <div v-if="filteredTasks.length === 0 && !tasksLoading" class="flex flex-col items-center justify-center py-16 px-4">
            <div class="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <span class="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500" aria-hidden="true">
                {{ hasActiveFilters ? 'filter_list_off' : (activeTab === 'completed' ? 'task_alt' : 'inbox') }}
              </span>
            </div>
            <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">
              {{ hasActiveFilters ? 'No matching tasks' : (activeTab === 'completed' ? 'No completed tasks yet' : 'No tasks yet') }}
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-6">
              {{ hasActiveFilters 
                ? 'Try adjusting your filters or search query' 
                : (activeTab === 'completed' 
                    ? 'Complete some tasks and they\'ll appear here' 
                    : 'Create your first task to get started') 
              }}
            </p>
            <div class="flex gap-3">
              <button
                v-if="hasActiveFilters"
                @click="clearFilters"
                class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Clear filters
              </button>
              <button
                v-if="!hasActiveFilters && activeTab !== 'completed'"
                @click="isAddModalOpen = true"
                class="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                Create your first task
              </button>
            </div>
          </div>

          <TaskCard
            v-else
            v-for="task in filteredTasks"
            :key="task.id"
            :task="task"
            :categories="categories"
            @toggle="handleToggleTask(task.id)"
            @toggle-subtask="handleToggleSubtask"
            @delete="handleDeleteTask(task.id)"
            @delete-subtask="handleDeleteSubtask"
            @edit="handleEditTask"
            @update-subtask-title="handleUpdateSubtaskTitle"
            @update-category="handleUpdateTaskCategory"
          />
        </div>

      </div>
    </main>

    <AddTaskModal
      :is-open="isAddModalOpen"
      :categories="categories"
      @close="isAddModalOpen = false"
      @save="handleSaveNewTask"
    />

    <EditTaskModal
      :is-open="isEditModalOpen"
      :task="taskToEdit"
      :categories="categories"
      @close="handleCloseEditModal"
      @save="handleSaveEditedTask"
    />

    <CategoryManagerModal
      :is-open="isCategoryManagerOpen"
      :categories="categories"
      :tasks="tasks"
      @close="isCategoryManagerOpen = false"
      @update-category="(id, updates) => updateCategoryFn(id, updates)"
      @create-category="(name, color) => createCategory(name, color)"
      @delete-category="(id) => deleteCategoryFn(id)"
    />

    <!-- Subtask Delete Confirmation Modal -->
    <ConfirmModal
      :is-open="showSubtaskDeleteConfirm"
      title="Delete Subtask"
      :message="`Are you sure you want to delete '${subtaskToDelete?.title}'?`"
      confirm-text="Delete"
      cancel-text="Cancel"
      variant="danger"
      icon="delete"
      @confirm="handleConfirmSubtaskDelete"
      @cancel="showSubtaskDeleteConfirm = false"
    />

    <!-- Toast Notifications -->
    <ToastContainer />
  </template>
</template>
