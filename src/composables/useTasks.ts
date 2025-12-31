import { ref, watch, onMounted, onUnmounted } from 'vue';
import { pb } from '../services/pocketbase';
import type { Task, Category, Subtask } from '../types';
import {
  getCachedTasks,
  setCachedTasks,
  addToQueue,
  getQueue,
  removeFromQueue,
  isOnline
} from '../services/offlineQueue';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export function useTasks(userId: () => string | undefined) {
  const tasks = ref<Task[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const syncStatus = ref<SyncStatus>('synced');

  // Fetch tasks from server
  const fetchTasks = async () => {
    const id = userId();
    if (!id) return;
    
    try {
      syncStatus.value = 'syncing';
      const records = await pb.collection('tasks').getFullList<Task>({
        filter: `user = "${id}"`,
        sort: '-created'
      });
      tasks.value = records;
      setCachedTasks(records);
      syncStatus.value = 'synced';
      error.value = null;
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
      // Load from cache if offline
      if (!isOnline()) {
        const cached = getCachedTasks();
        tasks.value = cached;
        syncStatus.value = 'offline';
      } else {
        error.value = 'Failed to load tasks';
        syncStatus.value = 'error';
      }
    } finally {
      loading.value = false;
    }
  };

  // Process offline queue
  const processQueue = async () => {
    const id = userId();
    if (!id || !isOnline()) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    syncStatus.value = 'syncing';

    for (const op of queue) {
      try {
        if (op.type === 'create' && op.data) {
          await pb.collection('tasks').create({
            ...op.data,
            user: id
          });
        } else if (op.type === 'update' && op.recordId && op.data) {
          await pb.collection('tasks').update(op.recordId, op.data);
        } else if (op.type === 'delete' && op.recordId) {
          await pb.collection('tasks').delete(op.recordId);
        }
        removeFromQueue(op.id);
      } catch (e) {
        console.error('Failed to process queue operation:', e);
        // If record not found, remove from queue
        if ((e as Record<string, unknown>)?.status === 404) {
          removeFromQueue(op.id);
        }
      }
    }

    // Refresh tasks after processing queue
    await fetchTasks();
  };

  // CRUD Operations
  const createTask = async (data: Omit<Task, 'id' | 'user'>) => {
    const id = userId();
    if (!id) return;

    const tempId = 'temp_' + Date.now().toString() + Math.random().toString();
    const newTask: Task = {
      ...data,
      id: tempId,
      user: id
    };

    // Optimistic update
    tasks.value = [newTask, ...tasks.value];
    setCachedTasks(tasks.value);

    if (isOnline()) {
      try {
        const created = await pb.collection('tasks').create<Task>({
          ...data,
          user: id
        });
        // Replace temp task with real one
        tasks.value = tasks.value.map(t => t.id === tempId ? created : t);
        setCachedTasks(tasks.value);
      } catch (e) {
        console.error('Failed to create task:', e);
        // Queue for later
        addToQueue({ type: 'create', data: newTask, tempId });
        syncStatus.value = 'offline';
      }
    } else {
      addToQueue({ type: 'create', data: newTask, tempId });
    }
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    // Optimistic update
    tasks.value = tasks.value.map(t => t.id === taskId ? { ...t, ...data } : t);
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        await pb.collection('tasks').update(taskId, data);
      } catch (e) {
        console.error('Failed to update task:', e);
        addToQueue({ type: 'update', recordId: taskId, data });
        syncStatus.value = 'offline';
      }
    } else {
      addToQueue({ type: 'update', recordId: taskId, data });
    }
  };

  const deleteTask = async (taskId: string) => {
    // Optimistic update
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        await pb.collection('tasks').delete(taskId);
      } catch (e) {
        console.error('Failed to delete task:', e);
        addToQueue({ type: 'delete', recordId: taskId });
        syncStatus.value = 'offline';
      }
    } else {
      addToQueue({ type: 'delete', recordId: taskId });
    }
  };

  // Convenience methods
  const toggleTask = (taskId: string, isCompleted: boolean) => {
    return updateTask(taskId, { isCompleted: !isCompleted });
  };

  const updateTaskCategory = (taskId: string, category: Category) => {
    return updateTask(taskId, { category });
  };

  const updateSubtasks = (taskId: string, subtasks: Subtask[]) => {
    return updateTask(taskId, { subtasks });
  };

  // Event handlers
  const handleOnline = () => {
    syncStatus.value = 'syncing';
    processQueue();
  };

  const handleOffline = () => {
    syncStatus.value = 'offline';
  };

  // Setup real-time subscription
  let subscribed = false;

  const setupSubscription = (id: string) => {
    if (subscribed || !isOnline()) return;
    
    pb.collection('tasks').subscribe('*', (e) => {
      // Only handle events for current user's tasks
      if (e.record.user !== id) return;

      if (e.action === 'create') {
        tasks.value = [e.record as unknown as Task, ...tasks.value.filter(t => t.id !== e.record.id)];
        setCachedTasks(tasks.value);
      } else if (e.action === 'update') {
        tasks.value = tasks.value.map(t => t.id === e.record.id ? e.record as unknown as Task : t);
        setCachedTasks(tasks.value);
      } else if (e.action === 'delete') {
        tasks.value = tasks.value.filter(t => t.id !== e.record.id);
        setCachedTasks(tasks.value);
      }
    });
    subscribed = true;
  };

  // Watch for userId changes
  watch(userId, (newId) => {
    if (newId) {
      // Load cached tasks first
      const cached = getCachedTasks();
      if (cached.length > 0) {
        tasks.value = cached;
      }
      fetchTasks();
      setupSubscription(newId);
    } else {
      loading.value = false;
    }
  }, { immediate: true });

  onMounted(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    if (!isOnline()) {
      syncStatus.value = 'offline';
    }
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    pb.collection('tasks').unsubscribe();
  });

  return {
    tasks,
    loading,
    error,
    syncStatus,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    updateTaskCategory,
    updateSubtasks,
    refetch: fetchTasks
  };
}
