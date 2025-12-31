import { useState, useEffect, useCallback } from 'react';
import { pb } from '../services/pocketbase';
import { Task, Category, Subtask } from '../types';
import {
  getCachedTasks,
  setCachedTasks,
  addToQueue,
  getQueue,
  removeFromQueue,
  clearQueue,
  isOnline,
  QueuedOperation
} from '../services/offlineQueue';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Fetch tasks from server
  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    
    try {
      setSyncStatus('syncing');
      const records = await pb.collection('tasks').getFullList<Task>({
        filter: `user = "${userId}"`,
        sort: '-created'
      });
      setTasks(records);
      setCachedTasks(records);
      setSyncStatus('synced');
      setError(null);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
      // Load from cache if offline
      if (!isOnline()) {
        const cached = getCachedTasks();
        setTasks(cached);
        setSyncStatus('offline');
      } else {
        setError('Failed to load tasks');
        setSyncStatus('error');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Process offline queue
  const processQueue = useCallback(async () => {
    if (!userId || !isOnline()) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    setSyncStatus('syncing');

    for (const op of queue) {
      try {
        if (op.type === 'create' && op.data) {
          await pb.collection('tasks').create({
            ...op.data,
            user: userId
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
        if ((e as any)?.status === 404) {
          removeFromQueue(op.id);
        }
      }
    }

    // Refresh tasks after processing queue
    await fetchTasks();
  }, [userId, fetchTasks]);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Load cached tasks first for instant display
    const cached = getCachedTasks();
    if (cached.length > 0) {
      setTasks(cached);
    }

    // Then fetch fresh data
    fetchTasks();
  }, [userId, fetchTasks]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || !isOnline()) return;

    const unsubscribe = pb.collection('tasks').subscribe('*', (e) => {
      // Only handle events for current user's tasks
      if (e.record.user !== userId) return;

      if (e.action === 'create') {
        setTasks(prev => {
          const updated = [e.record as Task, ...prev.filter(t => t.id !== e.record.id)];
          setCachedTasks(updated);
          return updated;
        });
      } else if (e.action === 'update') {
        setTasks(prev => {
          const updated = prev.map(t => t.id === e.record.id ? e.record as Task : t);
          setCachedTasks(updated);
          return updated;
        });
      } else if (e.action === 'delete') {
        setTasks(prev => {
          const updated = prev.filter(t => t.id !== e.record.id);
          setCachedTasks(updated);
          return updated;
        });
      }
    });

    return () => {
      pb.collection('tasks').unsubscribe();
    };
  }, [userId]);

  // Online/offline handlers
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('syncing');
      processQueue();
    };

    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    if (!isOnline()) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processQueue]);

  // CRUD Operations

  const createTask = useCallback(async (data: Omit<Task, 'id' | 'user'>) => {
    if (!userId) return;

    const tempId = 'temp_' + Date.now().toString() + Math.random().toString();
    const newTask: Task = {
      ...data,
      id: tempId,
      user: userId
    };

    // Optimistic update
    setTasks(prev => {
      const updated = [newTask, ...prev];
      setCachedTasks(updated);
      return updated;
    });

    if (isOnline()) {
      try {
        const created = await pb.collection('tasks').create<Task>({
          ...data,
          user: userId
        });
        // Replace temp task with real one
        setTasks(prev => {
          const updated = prev.map(t => t.id === tempId ? created : t);
          setCachedTasks(updated);
          return updated;
        });
      } catch (e) {
        console.error('Failed to create task:', e);
        // Queue for later
        addToQueue({ type: 'create', data: newTask, tempId });
        setSyncStatus('offline');
      }
    } else {
      addToQueue({ type: 'create', data: newTask, tempId });
    }
  }, [userId]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    // Optimistic update
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...data } : t);
      setCachedTasks(updated);
      return updated;
    });

    if (isOnline() && !id.startsWith('temp_')) {
      try {
        await pb.collection('tasks').update(id, data);
      } catch (e) {
        console.error('Failed to update task:', e);
        addToQueue({ type: 'update', recordId: id, data });
        setSyncStatus('offline');
      }
    } else {
      addToQueue({ type: 'update', recordId: id, data });
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    // Optimistic update
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      setCachedTasks(updated);
      return updated;
    });

    if (isOnline() && !id.startsWith('temp_')) {
      try {
        await pb.collection('tasks').delete(id);
      } catch (e) {
        console.error('Failed to delete task:', e);
        addToQueue({ type: 'delete', recordId: id });
        setSyncStatus('offline');
      }
    } else {
      addToQueue({ type: 'delete', recordId: id });
    }
  }, []);

  // Convenience methods for specific updates

  const toggleTask = useCallback((id: string, isCompleted: boolean) => {
    return updateTask(id, { isCompleted: !isCompleted });
  }, [updateTask]);

  const updateTaskCategory = useCallback((id: string, category: Category) => {
    return updateTask(id, { category });
  }, [updateTask]);

  const updateSubtasks = useCallback((id: string, subtasks: Subtask[]) => {
    return updateTask(id, { subtasks });
  }, [updateTask]);

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
