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

export function useTasks(userId: () => string | undefined, userName?: () => string | undefined) {
  const tasks = ref<Task[]>([]);
  const deletedTasks = ref<Task[]>([]); // Tasks in trash bin
  const loading = ref(true);
  const error = ref<string | null>(null);
  const syncStatus = ref<SyncStatus>('synced');
  const sharedTaskIds = ref<Set<string>>(new Set());
  const pendingTempIds = ref<Set<string>>(new Set()); // Track pending task creations to prevent realtime duplicates

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
      // Filter out deleted tasks from active list
      const activeTasks = [
        ...(ownedTasks || []).filter(t => !t.deleted_at).map(t => ({ ...t, is_shared_with_me: false })),
        ...sharedTasks.filter(t => !t.deleted_at)
      ];

      // Separate deleted tasks for bin (owned only - can't see others' deleted tasks)
      const trashedTasks = (ownedTasks || [])
        .filter(t => t.deleted_at)
        .map(t => ({ ...t, is_shared_with_me: false }));

      tasks.value = activeTasks;
      deletedTasks.value = trashedTasks;
      // Track shared task IDs for real-time broadcast filtering
      sharedTaskIds.value = new Set(sharedTasks.map(t => t.id));
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

  // Broadcast task updates to shared task recipients
  const broadcastTaskUpdate = async (taskId: string, taskData: Task | null, eventType: 'UPDATE' | 'DELETE') => {
    try {
      // Check if task has active shares
      const { data: shares } = await supabase
        .from('task_shares')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .limit(1);

      if (shares && shares.length > 0) {
        // Task is shared, broadcast the update
        const channel = supabase.channel('shared-tasks-broadcast');
        await channel.send({
          type: 'broadcast',
          event: 'task-updated',
          payload: {
            task_id: taskId,
            updated_task: taskData,
            event_type: eventType
          }
        });
      }
    } catch (e) {
      // Non-critical: broadcast failure shouldn't affect the main operation
      console.warn('Failed to broadcast task update:', e);
    }
  };

  // Notify task owner when a shared user completes their task
  const notifyOwnerOfCompletion = async (taskId: string, taskTitle: string) => {
    try {
      const completedByName = userName?.() || 'Someone';
      const completedByUserId = userId();
      if (!completedByUserId) return;

      await supabase.functions.invoke('notify-task-completion', {
        body: {
          task_id: taskId,
          task_title: taskTitle,
          completed_by_name: completedByName,
          completed_by_user_id: completedByUserId
        }
      });
    } catch (e) {
      // Non-critical: notification failure shouldn't affect the main operation
      console.warn('Failed to notify owner of task completion:', e);
    }
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

    // Mark as pending to prevent realtime duplicate
    pendingTempIds.value.add(tempId);

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
        pendingTempIds.value.delete(tempId);
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to create task:', e);
        // Queue for later
        addToQueue({ type: 'create', data: newTask, tempId });
        pendingTempIds.value.delete(tempId);
        syncStatus.value = 'offline';
      }
    } else {
      addToQueue({ type: 'create', data: newTask, tempId });
      pendingTempIds.value.delete(tempId);
      syncStatus.value = 'offline';
    }
  };

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    // Get task before update to check if it's shared and completion status changed
    const taskBeforeUpdate = tasks.value.find(t => t.id === taskId);

    // Optimistic update
    tasks.value = tasks.value.map(t => t.id === taskId ? { ...t, ...data } : t);
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        syncStatus.value = 'syncing';
        const { data: updatedTask, error: updateError } = await supabase
          .from('tasks')
          .update(data)
          .eq('id', taskId)
          .select()
          .single();

        if (updateError) throw updateError;
        syncStatus.value = 'synced';

        // Broadcast update to shared task recipients
        if (updatedTask) {
          broadcastTaskUpdate(taskId, updatedTask, 'UPDATE');
        }

        // Notify owner if a shared user completed the task
        if (
          taskBeforeUpdate?.is_shared_with_me && // Task is shared with current user (not owned)
          data.is_completed === true && // Being marked as complete
          !taskBeforeUpdate.is_completed // Was not complete before
        ) {
          notifyOwnerOfCompletion(taskId, taskBeforeUpdate.title);
        }
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

  // Soft delete - move to trash
  const deleteTask = async (taskId: string) => {
    const taskToDelete = tasks.value.find(t => t.id === taskId);
    if (!taskToDelete) return;

    const deletedAt = new Date().toISOString();

    // Optimistic update - move to trash
    tasks.value = tasks.value.filter(t => t.id !== taskId);
    deletedTasks.value = [{ ...taskToDelete, deleted_at: deletedAt }, ...deletedTasks.value];
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        syncStatus.value = 'syncing';

        // Broadcast deletion to shared task recipients
        await broadcastTaskUpdate(taskId, null, 'DELETE');

        const { error: updateError } = await supabase
          .from('tasks')
          .update({ deleted_at: deletedAt })
          .eq('id', taskId);

        if (updateError) throw updateError;
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to soft delete task:', e);
        // Revert optimistic update on error
        deletedTasks.value = deletedTasks.value.filter(t => t.id !== taskId);
        tasks.value = [taskToDelete, ...tasks.value];
        setCachedTasks(tasks.value);
        syncStatus.value = 'error';
      }
    } else if (!isOnline()) {
      addToQueue({ type: 'update', recordId: taskId, data: { deleted_at: deletedAt } });
      syncStatus.value = 'offline';
    }
  };

  // Restore task from trash
  const restoreTask = async (taskId: string) => {
    const taskToRestore = deletedTasks.value.find(t => t.id === taskId);
    if (!taskToRestore) return;

    // Optimistic update - move back to active
    deletedTasks.value = deletedTasks.value.filter(t => t.id !== taskId);
    const restoredTask = { ...taskToRestore, deleted_at: undefined };
    tasks.value = [restoredTask, ...tasks.value];
    setCachedTasks(tasks.value);

    if (isOnline() && !taskId.startsWith('temp_')) {
      try {
        syncStatus.value = 'syncing';

        const { error: updateError } = await supabase
          .from('tasks')
          .update({ deleted_at: null })
          .eq('id', taskId);

        if (updateError) throw updateError;
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to restore task:', e);
        // Revert optimistic update
        tasks.value = tasks.value.filter(t => t.id !== taskId);
        deletedTasks.value = [taskToRestore, ...deletedTasks.value];
        setCachedTasks(tasks.value);
        syncStatus.value = 'error';
      }
    } else if (!isOnline()) {
      addToQueue({ type: 'update', recordId: taskId, data: { deleted_at: undefined } });
      syncStatus.value = 'offline';
    }
  };

  // Permanently delete task (from trash)
  const permanentlyDeleteTask = async (taskId: string) => {
    // Optimistic update
    deletedTasks.value = deletedTasks.value.filter(t => t.id !== taskId);

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
        console.error('Failed to permanently delete task:', e);
        addToQueue({ type: 'delete', recordId: taskId });
        syncStatus.value = 'offline';
      }
    } else if (!isOnline()) {
      addToQueue({ type: 'delete', recordId: taskId });
      syncStatus.value = 'offline';
    }
  };

  // Empty entire trash
  const emptyTrash = async () => {
    const trashedIds = deletedTasks.value.map(t => t.id);
    if (trashedIds.length === 0) return;

    // Optimistic update
    deletedTasks.value = [];

    if (isOnline()) {
      try {
        syncStatus.value = 'syncing';

        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .in('id', trashedIds.filter(id => !id.startsWith('temp_')));

        if (deleteError) throw deleteError;
        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to empty trash:', e);
        // Fallback to queueing deletes individually
        trashedIds.forEach(id => {
          addToQueue({ type: 'delete', recordId: id });
        });
        syncStatus.value = 'offline';
      }
    } else {
      // Queue all deletes
      trashedIds.forEach(id => {
        addToQueue({ type: 'delete', recordId: id });
      });
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

  const reorderTasks = async (reorderedTasks: Task[]) => {
    // Optimistic update with new order indices
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      order_index: index
    }));

    // Update local state
    const reorderedIds = new Set(reorderedTasks.map(t => t.id));
    tasks.value = tasks.value.map(t => {
      if (reorderedIds.has(t.id)) {
        const updated = updatedTasks.find(ut => ut.id === t.id);
        return updated || t;
      }
      return t;
    });
    setCachedTasks(tasks.value);

    if (isOnline()) {
      try {
        syncStatus.value = 'syncing';

        // Batch update all order indices
        for (const task of updatedTasks) {
          if (!task.id.startsWith('temp_')) {
            const { error: updateError } = await supabase
              .from('tasks')
              .update({ order_index: task.order_index })
              .eq('id', task.id);

            if (updateError) throw updateError;
          }
        }

        syncStatus.value = 'synced';
      } catch (e) {
        console.error('Failed to reorder tasks:', e);
        syncStatus.value = 'error';
        // Refetch on error to sync with server
        await fetchTasks();
      }
    }
  };

  // Event handlers
  const handleOnline = () => {
    syncStatus.value = 'syncing';
    processQueue();
    // Re-establish broadcast subscription after coming back online
    setupBroadcastSubscription();
  };

  const handleOffline = () => {
    syncStatus.value = 'offline';
  };

  // Setup real-time subscription
  let channel: RealtimeChannel | null = null;
  let sharesChannel: RealtimeChannel | null = null;
  let broadcastChannel: RealtimeChannel | null = null;

  // Setup broadcast subscription for shared task updates
  const setupBroadcastSubscription = () => {
    if (broadcastChannel) return;

    broadcastChannel = supabase
      .channel('shared-tasks-broadcast')
      .on('broadcast', { event: 'task-updated' }, (payload) => {
        const { task_id, updated_task, event_type } = payload.payload as {
          task_id: string;
          updated_task: Task | null;
          event_type: 'UPDATE' | 'DELETE';
        };

        // Only process if this is a task shared with us
        if (!sharedTaskIds.value.has(task_id)) return;

        if (event_type === 'UPDATE' && updated_task) {
          // Merge update while preserving sharing metadata
          tasks.value = tasks.value.map(t =>
            t.id === task_id
              ? { ...t, ...updated_task, is_shared_with_me: true, shared_by: t.shared_by }
              : t
          );
          setCachedTasks(tasks.value);
        } else if (event_type === 'DELETE') {
          tasks.value = tasks.value.filter(t => t.id !== task_id);
          sharedTaskIds.value.delete(task_id);
          setCachedTasks(tasks.value);
        }
      })
      .subscribe();
  };

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
            // Skip if we have pending temp tasks - createTask will handle the replacement
            if (pendingTempIds.value.size > 0) {
              return;
            }
            // Check if task already exists (from optimistic update in createTask)
            const existingTask = tasks.value.find(t => t.id === newTask.id);
            if (existingTask) {
              // Task already exists, merge the update instead of duplicating
              tasks.value = tasks.value.map(t => t.id === newTask.id ? { ...t, ...newTask } : t);
            } else {
              // New task from realtime, add it
              tasks.value = [newTask, ...tasks.value];
            }
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
        async (payload) => {
          // Handle share revocation immediately
          if (payload.eventType === 'DELETE') {
            const revokedTaskId = (payload.old as { task_id?: string })?.task_id;
            if (revokedTaskId) {
              tasks.value = tasks.value.filter(t => t.id !== revokedTaskId);
              sharedTaskIds.value.delete(revokedTaskId);
              setCachedTasks(tasks.value);
            }
          } else if (payload.eventType === 'UPDATE') {
            const shareData = payload.new as { status?: string; task_id?: string };
            // If share was revoked, remove the task immediately
            if (shareData.status === 'revoked' && shareData.task_id) {
              tasks.value = tasks.value.filter(t => t.id !== shareData.task_id);
              sharedTaskIds.value.delete(shareData.task_id);
              setCachedTasks(tasks.value);
            } else {
              // Other status changes - refetch to get updated data
              await fetchTasks();
            }
          } else {
            // New share - refetch to get the new task
            await fetchTasks();
          }
        }
      )
      .subscribe();

    // Setup broadcast subscription for shared task updates from owners
    setupBroadcastSubscription();
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
    if (broadcastChannel) {
      supabase.removeChannel(broadcastChannel);
    }
  });

  return {
    tasks,
    deletedTasks,
    loading,
    error,
    syncStatus,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    permanentlyDeleteTask,
    emptyTrash,
    toggleTask,
    updateTaskCategory,
    updateSubtasks,
    reorderTasks,
    refreshTasks: fetchTasks,
    refetch: fetchTasks
  };
}
