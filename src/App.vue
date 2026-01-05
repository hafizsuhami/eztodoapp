<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Header from './components/Header.vue';
import TaskGroup from './components/TaskGroup.vue';
import AddTaskModal from './components/AddTaskModal.vue';
import EditTaskModal from './components/EditTaskModal.vue';
import LoginModal from './components/LoginModal.vue';
import LandingPage from './components/LandingPage.vue';
import CategoryManagerModal from './components/CategoryManagerModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import ToastContainer from './components/ToastContainer.vue';
import InstallPrompt from './components/InstallPrompt.vue';
import ShareTaskModal from './components/ShareTaskModal.vue';
import WhatsNewModal from './components/WhatsNewModal.vue';
import { type TaskStatus, type Subtask, type CategoryId, type Task } from './types';
import { useAuth } from './composables/useAuth';
import { useTasks } from './composables/useTasks';
import { useCategories } from './composables/useCategories';
import { useToast } from './composables/useToast';
import { usePushNotifications } from './composables/usePushNotifications';
import { useTaskSharing } from './composables/useTaskSharing';
import { parseTaskInput, formatParsedDate } from './lib/parseTaskInput';

// Build-time version info injected by Vite
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_DATE__: string;

const appVersion = __APP_VERSION__;
const gitCommit = __GIT_COMMIT__;
const buildDate = __BUILD_DATE__;

// Auth composable
const { user, loading: authLoading, isAuthenticated, loginWithGoogle, logout, updateNotifySharedCompletion } = useAuth();

// Toast notifications
const toast = useToast();

// Push notifications - link OneSignal user to Supabase user
const { setExternalUserId, isSubscribed } = usePushNotifications();

// Task sharing
const { claimPendingShares, acceptShareByToken, getSharePreview, loading: shareLoading } = useTaskSharing();

// Share link handling
const shareToken = ref<string | null>(null);
const sharePreview = ref<{ task: any; owner: any } | null>(null);
const shareAccepting = ref(false);
const shareError = ref<string | null>(null);

// Check if we're on a share link URL and load preview
const checkShareUrl = async () => {
  const path = window.location.pathname;
  const match = path.match(/^\/share\/([a-zA-Z0-9_-]+)$/);
  if (match) {
    shareToken.value = match[1];
    // Load task preview
    const preview = await getSharePreview(match[1]);
    if (preview) {
      sharePreview.value = preview;
    } else {
      shareError.value = 'Invalid or expired share link';
    }
  }
};

// Accept share when user clicks accept
const handleAcceptShare = async () => {
  if (!shareToken.value || !user.value?.id) return;

  shareAccepting.value = true;
  shareError.value = null;

  try {
    const result = await acceptShareByToken(shareToken.value);
    if (result) {
      toast.success('Task added to your list!');
      // Clear and redirect to home
      shareToken.value = null;
      sharePreview.value = null;
      window.history.replaceState({}, '', '/');
    } else {
      shareError.value = 'Failed to accept share. The link may be invalid or expired.';
    }
  } catch (e: any) {
    shareError.value = e.message || 'Failed to accept share';
  } finally {
    shareAccepting.value = false;
  }
};

// Decline share - just go home
const handleDeclineShare = () => {
  shareToken.value = null;
  sharePreview.value = null;
  window.history.replaceState({}, '', '/');
};

// Check for share URL on mount
onMounted(() => {
  checkShareUrl();
});

// When user logs in and has push notifications enabled, link their Supabase ID to OneSignal
watch(
  () => [user.value?.id, isSubscribed.value],
  async ([userId, subscribed]) => {
    if (userId && subscribed) {
      await setExternalUserId(userId);
    }
  },
  { immediate: true }
);

// When user logs in, claim any pending email shares (not link shares - those need manual accept)
watch(
  () => user.value?.id,
  async (userId) => {
    if (userId) {
      // Claim any pending email shares (auto-accept for email invites)
      const claimed = await claimPendingShares();
      if (claimed > 0) {
        toast.success(`${claimed} shared task${claimed > 1 ? 's' : ''} added to your list!`);
      }
    }
  },
  { immediate: true }
);

// Tasks composable - reactive to user.value.id
const getUserId = () => user.value?.id;
const getUserName = () => user.value?.name;
const {
  tasks,
  loading: tasksLoading,
  syncStatus,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  updateTaskCategory,
  updateSubtasks,
  reorderTasks
} = useTasks(getUserId, getUserName);

// Categories composable
const {
  categories,
  loading: categoriesLoading,
  getCategoryById,
  createCategory,
  updateCategory: updateCategoryFn,
  deleteCategory: deleteCategoryFn,
  reorderCategories
} = useCategories(getUserId);

// Local state
const activeTab = ref<TaskStatus>('today');
const searchQuery = ref('');
const categoryFilter = ref<CategoryId | null>(null);
const isAddModalOpen = ref(false);
const isCategoryManagerOpen = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Quick add state
const quickAddTitle = ref('');
const isQuickAddFocused = ref(false);

// Clear category filter when switching to shared tab (categories don't apply)
watch(activeTab, (newTab) => {
  if (newTab === 'shared') {
    categoryFilter.value = null;
  }
});

// NLI: Parse quick-add input for natural language
const parsedQuickAdd = computed(() => {
  if (!quickAddTitle.value.trim()) return null;
  return parseTaskInput(quickAddTitle.value, categories.value);
});

// NLI: Show preview for quick-add when something is detected
const showQuickAddPreview = computed(() => {
  if (!parsedQuickAdd.value) return false;
  return parsedQuickAdd.value.dueDate || parsedQuickAdd.value.categoryId;
});

// Edit task modal state
const isEditModalOpen = ref(false);
const taskToEdit = ref<Task | null>(null);

// Share task modal state
const isShareModalOpen = ref(false);
const taskToShare = ref<Task | null>(null);

// Subtask delete confirmation state
const showSubtaskDeleteConfirm = ref(false);
const subtaskToDelete = ref<{ taskId: string; subtaskId: string; title: string } | null>(null);

// Recently deleted task for undo
const recentlyDeletedTask = ref<Task | null>(null);

// Date helpers
const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isToday = (dateStr: string) => {
  if (!dateStr || dateStr === 'No Due Date') return false;
  const taskDate = getStartOfDay(new Date(dateStr));
  const today = getStartOfDay(new Date());
  return taskDate.getTime() === today.getTime();
};

const isUpcoming = (dateStr: string) => {
  if (!dateStr || dateStr === 'No Due Date') return false;
  const taskDate = getStartOfDay(new Date(dateStr));
  const today = getStartOfDay(new Date());
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  return taskDate.getTime() > today.getTime() && taskDate.getTime() <= nextWeek.getTime();
};

const isOverdue = (dateStr: string) => {
  if (!dateStr || dateStr === 'No Due Date') return false;
  const taskDate = getStartOfDay(new Date(dateStr));
  const today = getStartOfDay(new Date());
  return taskDate.getTime() < today.getTime();
};

// Computed values
const activeCount = computed(() => tasks.value.filter(t => !t.is_completed).length);
const completedCount = computed(() => tasks.value.filter(t => t.is_completed).length);
const todayCount = computed(() => tasks.value.filter(t => !t.is_completed && (isToday(t.due_date) || isOverdue(t.due_date))).length);
const sharedCount = computed(() => tasks.value.filter(t => t.is_shared_with_me).length);

const filteredTasks = computed(() => {
  return tasks.value.filter(task => {
    // 1. Status Filter
    if (activeTab.value === 'shared') {
      // Show only shared tasks (both completed and incomplete)
      if (!task.is_shared_with_me) return false;
      // Skip category filter for shared tasks, only apply search
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        return task.title.toLowerCase().includes(query) ||
               task.subtasks?.some(s => s.title.toLowerCase().includes(query));
      }
      return true;
    } else if (activeTab.value === 'today') {
      // Show overdue + today's tasks (not completed)
      if (task.is_completed) return false;
      if (!isToday(task.due_date) && !isOverdue(task.due_date)) return false;
    } else if (activeTab.value === 'all') {
      // Show all incomplete tasks
      if (task.is_completed) return false;
    } else if (activeTab.value === 'completed') {
      if (!task.is_completed) return false;
    }

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

// Group tasks by date section for better organization
const groupedTasks = computed(() => {
  const groups: { label: string; icon: string; tasks: Task[]; color: string }[] = [];

  // Helper to sort tasks by order_index
  const sortByOrder = (taskList: Task[]) => 
    [...taskList].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  // Shared tab: group by Active and Completed
  if (activeTab.value === 'shared') {
    const incomplete = filteredTasks.value.filter(t => !t.is_completed);
    const completed = filteredTasks.value.filter(t => t.is_completed);

    if (incomplete.length > 0) {
      groups.push({ label: 'Active', icon: 'task', tasks: sortByOrder(incomplete), color: 'text-primary' });
    }
    if (completed.length > 0) {
      groups.push({ label: 'Completed', icon: 'task_alt', tasks: sortByOrder(completed), color: 'text-green-500' });
    }
    return groups.length ? groups : [{ label: '', icon: '', tasks: [], color: '' }];
  }

  // Only group in 'all' and 'today' views
  if (activeTab.value === 'completed' || searchQuery.value) {
    // No grouping for completed or search results
    return [{ label: '', icon: '', tasks: sortByOrder(filteredTasks.value), color: '' }];
  }
  
  const overdueTasks = filteredTasks.value.filter(t => isOverdue(t.due_date));
  const todayTasks = filteredTasks.value.filter(t => isToday(t.due_date));
  const upcomingTasks = filteredTasks.value.filter(t => isUpcoming(t.due_date));
  const noDueTasks = filteredTasks.value.filter(t => !t.due_date || t.due_date === 'No Due Date');
  const otherTasks = filteredTasks.value.filter(t => 
    t.due_date && 
    t.due_date !== 'No Due Date' && 
    !isOverdue(t.due_date) && 
    !isToday(t.due_date) && 
    !isUpcoming(t.due_date)
  );
  
  if (overdueTasks.length > 0) {
    groups.push({ label: 'Overdue', icon: 'warning', tasks: sortByOrder(overdueTasks), color: 'text-red-500' });
  }
  if (todayTasks.length > 0) {
    groups.push({ label: 'Today', icon: 'today', tasks: sortByOrder(todayTasks), color: 'text-amber-500' });
  }
  if (upcomingTasks.length > 0 && activeTab.value !== 'today') {
    groups.push({ label: 'Upcoming', icon: 'event_upcoming', tasks: sortByOrder(upcomingTasks), color: 'text-blue-500' });
  }
  if (otherTasks.length > 0 && activeTab.value === 'all') {
    groups.push({ label: 'Later', icon: 'schedule', tasks: sortByOrder(otherTasks), color: 'text-slate-400' });
  }
  if (noDueTasks.length > 0 && activeTab.value === 'all') {
    groups.push({ label: 'No due date', icon: 'all_inbox', tasks: sortByOrder(noDueTasks), color: 'text-slate-400' });
  }
  
  // If no groups were created, return ungrouped
  if (groups.length === 0) {
    return [{ label: '', icon: '', tasks: sortByOrder(filteredTasks.value), color: '' }];
  }
  
  return groups;
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

// Tab options with icons and counts
const tabOptions: { key: TaskStatus; label: string; shortLabel: string; icon: string }[] = [
  { key: 'today', label: 'Today', shortLabel: 'Today', icon: 'today' },
  { key: 'all', label: 'All', shortLabel: 'All', icon: 'list' },
  { key: 'completed', label: 'Done', shortLabel: 'Done', icon: 'task_alt' },
  { key: 'shared', label: 'Shared', shortLabel: 'Shared', icon: 'group' }
];

const getTabCount = (tab: TaskStatus) => {
  switch (tab) {
    case 'today': return todayCount.value;
    case 'all': return activeCount.value;
    case 'completed': return completedCount.value;
    case 'shared': return sharedCount.value;
    default: return 0;
  }
};

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
  dueDate: string,
  reminderAt: string | null
) => {
  updateTask(taskId, {
    title,
    subtasks,
    category,
    due_date: dueDate,
    reminder_at: reminderAt || undefined,
    reminder_sent: reminderAt ? false : undefined
  });
  isEditModalOpen.value = false;
  taskToEdit.value = null;
  toast.success('Task updated');
};

const handleCloseEditModal = () => {
  isEditModalOpen.value = false;
  taskToEdit.value = null;
};

const handleShareTask = (id: string) => {
  const task = tasks.value.find(t => t.id === id);
  if (task) {
    taskToShare.value = task;
    isShareModalOpen.value = true;
  }
};

const handleCloseShareModal = () => {
  isShareModalOpen.value = false;
  taskToShare.value = null;
};

const handleSaveNewTask = (title: string, subtaskTitles: string[], category: CategoryId, dueDate: string, reminderAt: string | null) => {
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
    subtasks,
    reminder_at: reminderAt || undefined,
    reminder_sent: false
  });
  toast.success('Task created');
};

// Quick add handler with NLI support
const handleQuickAdd = () => {
  if (!quickAddTitle.value.trim()) return;

  const parsed = parsedQuickAdd.value;
  const defaultCategory = categories.value[0]?.id || '';

  // Use parsed values if available
  const title = parsed?.title || quickAddTitle.value.trim();
  const category = parsed?.categoryId || defaultCategory;
  const dueDate = parsed?.dueDate
    ? parsed.dueDate.toISOString().split('T')[0]
    : 'No Due Date';

  createTask({
    title,
    is_completed: false,
    category,
    due_date: dueDate,
    due_date_color: dueDate === 'No Due Date' ? 'text-slate-500' : 'text-blue-500',
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
  activeTab.value = 'today';
};

const hasActiveFilters = computed(() => {
  return categoryFilter.value || searchQuery.value || activeTab.value !== 'today';
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

  <!-- Share Link Landing Page -->
  <div v-else-if="shareToken" class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#111722] p-4">
    <div class="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700">
      <!-- Loading preview -->
      <div v-if="shareLoading && !sharePreview" class="flex flex-col items-center gap-3 py-8">
        <span class="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
        <p class="text-slate-500 dark:text-slate-400 text-sm">Loading task...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="shareError && !sharePreview" class="text-center py-8">
        <div class="size-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-3xl text-red-500">error</span>
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Link Invalid</h2>
        <p class="text-slate-500 dark:text-slate-400 text-sm mb-6">{{ shareError }}</p>
        <button
          @click="handleDeclineShare"
          class="text-sm text-primary hover:underline"
        >
          Go to homepage
        </button>
      </div>

      <!-- Task Preview -->
      <template v-else-if="sharePreview">
        <div class="text-center mb-4">
          <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <span class="material-symbols-outlined text-2xl text-primary">share</span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            <span class="font-medium text-slate-700 dark:text-slate-200">{{ sharePreview.owner?.name || 'Someone' }}</span> shared a task with you
          </p>
        </div>

        <!-- Task Card Preview -->
        <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-200 dark:border-slate-700">
          <h3 class="font-semibold text-slate-900 dark:text-white mb-2">
            {{ sharePreview.task?.title }}
          </h3>
          <div class="flex flex-wrap gap-2 text-xs">
            <span v-if="sharePreview.task?.due_date && sharePreview.task.due_date !== 'No Due Date'" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
              <span class="material-symbols-outlined text-[14px]">calendar_today</span>
              {{ sharePreview.task.due_date }}
            </span>
            <span v-if="sharePreview.task?.subtasks?.length" class="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
              <span class="material-symbols-outlined text-[14px]">checklist</span>
              {{ sharePreview.task.subtasks.length }} subtask{{ sharePreview.task.subtasks.length > 1 ? 's' : '' }}
            </span>
          </div>
        </div>

        <div v-if="shareAccepting" class="flex flex-col items-center gap-3 py-2">
          <span class="material-symbols-outlined text-2xl text-primary animate-spin">progress_activity</span>
          <p class="text-slate-500 dark:text-slate-400 text-sm">Adding to your list...</p>
        </div>

        <template v-else-if="!isAuthenticated">
          <p class="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">Sign in to add this task to your list</p>
          <button
            @click="loginWithGoogle"
            class="w-full py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
            </svg>
            Sign in with Google
          </button>
          <button
            @click="handleDeclineShare"
            class="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            No thanks
          </button>
        </template>

        <template v-else>
          <div class="flex gap-2">
            <button
              @click="handleDeclineShare"
              class="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Decline
            </button>
            <button
              @click="handleAcceptShare"
              class="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
            >
              Accept
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>

  <!-- Landing Page for non-authenticated users -->
  <LandingPage
    v-else-if="!isAuthenticated"
    @get-started="loginWithGoogle"
  />

  <!-- Main App for authenticated users -->
  <template v-else>
    <Header :user="user" :sync-status="syncStatus" @logout="logout" @update-notify-setting="updateNotifySharedCompletion" />

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
                  <template v-if="todayCount > 0">
                    You have {{ todayCount }} task{{ todayCount !== 1 ? 's' : '' }} for today
                  </template>
                  <template v-else>
                    All clear for today! ✨
                  </template>
                </p>
              </div>
            </div>
            <button
              @click="isAddModalOpen = true"
              class="hidden md:flex items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary hover:bg-primary/90 transition-all active:scale-95 text-white text-base font-bold shadow-lg shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              aria-label="Add new task"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              <span class="whitespace-nowrap">Add New Task</span>
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

            <!-- NLI Quick Add Preview -->
            <div
              v-if="showQuickAddPreview && parsedQuickAdd"
              class="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              <span class="text-primary/70 font-medium">Detected:</span>
              <span v-if="parsedQuickAdd.dueDate" class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                <span class="material-symbols-outlined text-[12px]">calendar_today</span>
                {{ formatParsedDate(parsedQuickAdd.dueDate) }}
              </span>
              <span v-if="parsedQuickAdd.categoryName" class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                <span class="material-symbols-outlined text-[12px]">label</span>
                {{ parsedQuickAdd.categoryName }}
              </span>
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
            <div class="flex w-full sm:w-auto sm:flex-shrink-0 justify-start gap-1 sm:gap-2 px-1 overflow-x-auto scrollbar-hide">
              <button
                v-for="tab in tabOptions"
                :key="tab.key"
                @click="activeTab = tab.key"
                :class="[
                  'group flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-all cursor-pointer text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0',
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                ]"
                :aria-label="tab.label"
              >
                <span class="material-symbols-outlined text-[16px] sm:text-[18px]" aria-hidden="true">{{ tab.icon }}</span>
                <span class="sm:hidden">{{ tab.shortLabel }}</span>
                <span class="hidden sm:inline">{{ tab.label }}</span>
                <span
                  v-if="getTabCount(tab.key) > 0"
                  :class="[
                    'text-xs px-1 sm:px-1.5 py-0.5 rounded-full min-w-[18px] sm:min-w-[20px] text-center',
                    activeTab === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  ]"
                >
                  {{ getTabCount(tab.key) }}
                </span>
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

          <!-- Chips (Categories) - Hidden on shared tab -->
          <div v-if="activeTab !== 'shared'" class="flex flex-col gap-2">
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
            <div class="size-48 flex items-center justify-center mb-4">
              <img src="./assets/empty-state.png" alt="No tasks" class="w-full h-full object-contain opacity-90 hover:scale-105 transition-transform duration-500" />
            </div>
            <h3 class="text-xl font-bold text-slate-700 dark:text-slate-200 mb-1">
              {{ hasActiveFilters ? 'No matching tasks' :
                 (activeTab === 'shared' ? 'No shared tasks' :
                 (activeTab === 'completed' ? 'No completed tasks yet' :
                 (activeTab === 'today' ? 'All clear for today!' : 'No tasks yet'))) }}
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-6">
              {{ hasActiveFilters
                ? 'Try adjusting your filters or search query'
                : (activeTab === 'shared'
                    ? 'Tasks shared with you by others will appear here'
                    : (activeTab === 'completed'
                        ? 'Complete some tasks and they\'ll appear here'
                        : (activeTab === 'today'
                            ? 'Enjoy your free time or add a new task'
                            : 'Create your first task to get started')))
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
                v-if="!hasActiveFilters && activeTab !== 'completed' && activeTab !== 'shared'"
                @click="isAddModalOpen = true"
                class="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                {{ activeTab === 'today' ? 'Add task for today' : 'Add new task' }}
              </button>
            </div>
          </div>

          <!-- Grouped Task List -->
          <template v-else>
            <TaskGroup
              v-for="group in groupedTasks"
              :key="group.label || 'ungrouped'"
              :tasks="group.tasks"
              :categories="categories"
              :group-label="group.label"
              :group-icon="group.icon"
              :group-color="group.color"
              @toggle="handleToggleTask"
              @toggle-subtask="handleToggleSubtask"
              @delete="handleDeleteTask"
              @delete-subtask="handleDeleteSubtask"
              @edit="handleEditTask"
              @share="handleShareTask"
              @update-subtask-title="handleUpdateSubtaskTitle"
              @update-category="handleUpdateTaskCategory"
              @reorder-tasks="reorderTasks"
            />
          </template>
        </div>

      </div>
    </main>

    <!-- Footer with version -->
    <footer class="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
      <p>v{{ appVersion }}</p>
    </footer>

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
      @reorder-categories="(cats) => reorderCategories(cats)"
    />

    <ShareTaskModal
      :is-open="isShareModalOpen"
      :task="taskToShare"
      @close="handleCloseShareModal"
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

    <!-- Install Prompt (iOS + Android/Chrome) -->
    <InstallPrompt />

    <!-- What's New Modal -->
    <WhatsNewModal
      :user-id="user?.id || null"
      :last-seen-version="user?.lastSeenChangelog || null"
    />
  </template>
</template>
