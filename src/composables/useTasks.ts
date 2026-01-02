import { ref, watch, onMounted, onUnmounted } from 'vue';
import { supabase } from '../services/supabase';
import type { Task, Subtask } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

  // Fetch tasks from server (owned + shared)
  const fetchTasks = async () => {
    const id = userId();
    if (!id) return;

    try {
      syncStatus.value = 'syncing';

      // Fetch owned tasks
      const { data: ownedTasks, error: ownedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Fetch tasks shared with this user (including owner profile info)
      const { data: sharedData, error: sharedError } = await supabase
        .from('task_shares')
        .select(`
          task_id,
          owner_id,
          tasks(*),
          profiles!task_shares_owner_id_fkey_profiles(id, name, avatar_url)
        `)
        .eq('shared_with_id', id)
        .eq('status', 'accepted');

      if (sharedError) throw sharedError;

      // Extract shared tasks and mark them with owner info
      const sharedTasks: Task[] = (sharedData || [])
        .filter(s => s.tasks)
        .map(s => {
          const profileData = s.profiles as { id: string; name: string; avatar_url: string }[] | { id: string; name: string; avatar_url: string } | null;
          const profile = Array.isArray(profileData) ? profileData[0] : profileData;
          return {
            ...(s.tasks as unknown as Task),
            is_shared_with_me: true,
            shared_by: profile ? {
              id: profile.id,
              name: profile.name || 'User',
              avatar: profile.avatar_url || ''
            } : undefined
          };
        });

      // Combine owned tasks (not shared) with shared tasks
      const allTasks = [
        ...(ownedTasks || []).map(t => ({ ...t, is_shared_with_me: false })),
        ...sharedTasks
      ];

      tasks.value = allTasks;
      setCachedTasks(tasks.value);
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
          await supabase
            .from('tasks')
            .insert({
              ...op.data,
              user_id: id,
              id: undefined // Let Supabase generate the ID
            });
        } else if (op.type === 'update' && op.recordId && op.data) {
          await supabase
            .from('tasks')
            .update(op.data)
            .eq('id', op.recordId);
        } else if (op.type === 'delete' && op.recordId) {
          await supabase
            .from('tasks')
            .delete()
            .eq('id', op.recordId);
        }
        removeFromQueue(op.id);
      } catch (e) {
        console.error('Failed to process queue operation:', e);
        // If record not found, remove from queue
        if ((e as Record<string, unknown>)?.code === 'PGRST116') {
          removeFromQueue(op.id);
        }
      }
    }

    // Refresh tasks after processing queue
    await fetchTasks();
  };

  // CRUD Operations
  const createTask = async (data: Omit<Task, 'id' | 'user_id'>) => {
    const id = userId();
    if (!id) return;

    const tempId = 'temp_' + Date.now().toString() + Math.random().toString();
    const newTask: Task = {
      ...data,
      id: tempId,
      user_id: id
    };

    // Optimistic update
    tasks.value = [newTask, ...tasks.value];
    setCachedTasks(tasks.value);

    if (isOnline()) {
      try {
        syncStatus.value = 'syncing';
        const { data: created, error: createError } = await supabase
          .from('tasks')
          .insert({
            user_id: id,
            title: data.title,
            is_completed: data.is_completed,
            category: data.category,
            due_date: data.due_date,
            due_date_color: data.due_date_color,
            due_date_bg: data.due_date_bg,
            due_date_icon: data.due_date_icon,
            subtasks: data.subtasks || [],
            reminder_at: data.reminder_at || null,
            reminder_sent: false
          })
          .select()
          .single();

        if (createError) throw createError;
        
        // Replace temp task with real one
        tasks.value = tasks.value.map(t => t.id === tempId ? created : t);
        setCachedTasks(tasks.value);
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to create task:', e);
        // Queue for later
        addToQueue({ type: 'create', data: newTask, tempId });
        syncStatus.value = 'offline';
      }
    } else {
      addToQueue({ type: 'create', data: newTask, tempId });
      syncStatus.value = 'offline';
    }
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    // Optimistic update
    tasks.value = tasks.value.map(t => t.id === taskId ? { ...t, ...data } : t);
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        syncStatus.value = 'syncing';
        const { error: updateError } = await supabase
          .from('tasks')
          .update(data)
          .eq('id', taskId);
        
        if (updateError) throw updateError;
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to update task:', e);
        addToQueue({ type: 'update', recordId: taskId, data });
        syncStatus.value = 'offline';
      }
    } else if (!isOnline()) {
      addToQueue({ type: 'update', recordId: taskId, data });
      syncStatus.value = 'offline';
    }
  };

  const deleteTask = async (taskId: string) => {
    // Optimistic update
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        syncStatus.value = 'syncing';
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId);
        
        if (deleteError) throw deleteError;
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to delete task:', e);
        addToQueue({ type: 'delete', recordId: taskId });
        syncStatus.value = 'offline';
      }
    } else if (!isOnline()) {
      addToQueue({ type: 'delete', recordId: taskId });
      syncStatus.value = 'offline';
    }
  };

  // Convenience methods
  const toggleTask = (taskId: string, is_completed: boolean) => {
    return updateTask(taskId, { is_completed: !is_completed });
  };

  const updateTaskCategory = (taskId: string, category: string) => {
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
  let channel: RealtimeChannel | null = null;
  let sharesChannel: RealtimeChannel | null = null;

  const setupSubscription = (id: string) => {
    if (channel || !isOnline()) return;

    // Subscribe to owned tasks changes
    channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            tasks.value = [newTask, ...tasks.value.filter(t => t.id !== newTask.id)];
            setCachedTasks(tasks.value);
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task;
            tasks.value = tasks.value.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t);
            setCachedTasks(tasks.value);
          } else if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old as { id: string };
            tasks.value = tasks.value.filter(t => t.id !== deletedTask.id);
            setCachedTasks(tasks.value);
          }
        }
      )
      .subscribe();

    // Subscribe to shares changes (when someone shares with this user)
    sharesChannel = supabase
      .channel('shares-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_shares',
          filter: `shared_with_id=eq.${id}`
        },
        async () => {
          // Refetch tasks when shares change
          await fetchTasks();
        }
      )
      .subscribe();
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
    if (channel) {
      supabase.removeChannel(channel);
    }
    if (sharesChannel) {
      supabase.removeChannel(sharesChannel);
    }
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
