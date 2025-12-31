<script setup lang="ts">
import { ref, computed } from 'vue';
import Header from './components/Header.vue';
import TaskCard from './components/TaskCard.vue';
import AddTaskModal from './components/AddTaskModal.vue';
import LoginModal from './components/LoginModal.vue';
import { Category, type TaskStatus, type Subtask } from './types';
import { useAuth } from './composables/useAuth';
import { useTasks } from './composables/useTasks';

// Auth composable
const { user, loading: authLoading, isAuthenticated, loginWithGoogle, logout } = useAuth();

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

// Local state
const activeTab = ref<TaskStatus>('active');
const searchQuery = ref('');
const categoryFilter = ref<Category | null>(null);
const isAddModalOpen = ref(false);

// Computed values
const activeCount = computed(() => tasks.value.filter(t => !t.is_completed).length);

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
      return task.title.toLowerCase().includes(query) ||
             task.category.toLowerCase().includes(query) ||
             task.subtasks?.some(s => s.title.toLowerCase().includes(query));
    }

    return true;
  });
});

// Get user's first name for greeting
const firstName = computed(() => user.value?.name?.split(' ')[0] || 'there');

// Tab options
const tabOptions: TaskStatus[] = ['all', 'active', 'completed'];

// Handlers
const handleToggleTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    toggleTask(id, task.is_completed);
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
  if (window.confirm("Are you sure you want to delete this subtask?")) {
    const task = tasks.value.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const updatedSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
      updateSubtasks(taskId, updatedSubtasks);
    }
  }
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

const handleUpdateTaskCategory = (taskId: string, newCategory: Category) => {
  updateTaskCategory(taskId, newCategory);
};

const handleDeleteTask = (id: string) => {
  deleteTask(id);
};

const handleEditTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    const newTitle = prompt("Update task title:", task.title);
    if (newTitle === null) {
      return;
    }

    // Handle Subtasks Edit
    const currentSubtasksStr = task.subtasks?.map(s => s.title).join(', ') || '';
    const newSubtasksStr = prompt("Update subtasks (comma separated):", currentSubtasksStr);

    let updatedSubtasks = task.subtasks || [];
    if (newSubtasksStr !== null && newSubtasksStr !== currentSubtasksStr) {
      // Simple reconstruction of subtasks if changed
      updatedSubtasks = newSubtasksStr.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(title => ({
          id: Date.now().toString() + Math.random().toString(),
          title,
          is_completed: false
        }));
    }

    if (newTitle.trim() !== "") {
      updateTask(id, {
        title: newTitle.trim(),
        subtasks: updatedSubtasks
      });
    }
  }
};

const handleSaveNewTask = (title: string, subtaskTitles: string[]) => {
  const subtasks: Subtask[] = subtaskTitles.map(s => ({
    id: Date.now().toString() + Math.random().toString(),
    title: s,
    is_completed: false
  }));

  createTask({
    title,
    is_completed: false,
    category: Category.Personal, // Default
    due_date: "No Due Date",
    due_date_color: "text-slate-500",
    subtasks
  });
};

const clearFilters = () => {
  categoryFilter.value = null;
  searchQuery.value = '';
  activeTab.value = 'all';
};

const hasActiveFilters = computed(() => {
  return categoryFilter.value || searchQuery.value || activeTab.value !== 'all';
});

// Category values for chips
const categoryValues = Object.values(Category);
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

  <!-- Main App -->
  <template v-else>
    <Header :user="user" :sync-status="syncStatus" @logout="logout" />

    <!-- Login Modal -->
    <LoginModal
      :is-open="!isAuthenticated"
      @login="loginWithGoogle"
    />

    <main class="flex flex-1 justify-center py-6 px-4 md:px-8">
      <div class="flex flex-col max-w-[800px] w-full gap-6">

        <!-- Heading & Summary -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
          <div class="flex flex-col gap-2">
            <h1 class="text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white">
              Good Morning, {{ firstName }}
            </h1>
            <p class="text-slate-500 dark:text-[#92a4c9] text-base font-medium">
              You have {{ activeCount }} active tasks today
            </p>
          </div>
          <button
            @click="isAddModalOpen = true"
            class="hidden md:flex items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary hover:bg-primary/90 transition-all active:scale-95 text-white text-base font-bold shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-[20px]">add</span>
            <span class="truncate">Add New Task</span>
          </button>
        </div>

        <!-- Mobile FAB (Floating Action Button) -->
        <button
          @click="isAddModalOpen = true"
          class="md:hidden fixed bottom-6 right-6 z-40 size-14 flex items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary/90 active:scale-90 transition-all"
        >
          <span class="material-symbols-outlined text-[28px]">add</span>
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
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  v-model="searchQuery"
                  class="w-full bg-slate-100 dark:bg-[#1e293b] text-slate-900 dark:text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary border-none placeholder-slate-400 transition-shadow"
                  placeholder="Search tasks..."
                />
              </div>
              <button class="p-2 text-slate-500 dark:text-[#92a4c9] hover:bg-slate-200 dark:hover:bg-[#232f48] rounded-lg transition-colors sm:hidden">
                <span class="material-symbols-outlined">filter_list</span>
              </button>
            </div>
          </div>

          <!-- Chips (Categories) -->
          <div class="flex gap-3 flex-wrap items-center">
            <span class="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider mr-1">
              Filter by:
            </span>

            <button
              v-for="cat in categoryValues"
              :key="cat"
              @click="categoryFilter = categoryFilter === cat ? null : cat"
              :class="[
                'flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg pl-3 pr-2 transition-colors',
                categoryFilter === cat
                  ? 'bg-slate-200 dark:bg-[#2d3b55] text-slate-800 dark:text-white'
                  : 'border border-slate-200 dark:border-[#232f48] hover:bg-slate-100 dark:hover:bg-[#1e293b] text-slate-500 dark:text-[#92a4c9]'
              ]"
            >
              <p class="text-sm font-medium leading-normal">{{ cat }}</p>
              <span
                v-if="categoryFilter === cat"
                class="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[18px]"
              >
                close
              </span>
            </button>

            <button
              v-if="hasActiveFilters"
              @click="clearFilters"
              class="ml-auto text-primary text-sm font-medium hover:underline hidden sm:block"
            >
              Clear all
            </button>
          </div>
        </div>

        <!-- Task List Container -->
        <div class="flex flex-col gap-3 pb-20">
          <div v-if="filteredTasks.length === 0 && !tasksLoading" class="text-center py-12 text-slate-500 dark:text-slate-400">
            <span class="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
            <p>No tasks found.</p>
          </div>

          <TaskCard
            v-else
            v-for="task in filteredTasks"
            :key="task.id"
            :task="task"
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
      @close="isAddModalOpen = false"
      @save="handleSaveNewTask"
    />
  </template>
</template>
