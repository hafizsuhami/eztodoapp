import type { Task, QueuedOperation } from '../types';

const TASKS_CACHE_KEY = 'taskmaster_tasks_cache';
const QUEUE_KEY = 'taskmaster_offline_queue';

// Task Cache Operations
export function getCachedTasks(): Task[] {
  try {
    const cached = localStorage.getItem(TASKS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export function setCachedTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to cache tasks:', e);
  }
}

export function clearCachedTasks(): void {
  localStorage.removeItem(TASKS_CACHE_KEY);
}

// Queue Operations
export function getQueue(): QueuedOperation[] {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

export function addToQueue(operation: Omit<QueuedOperation, 'id' | 'timestamp'>): void {
  const queue = getQueue();
  const newOp: QueuedOperation = {
    ...operation,
    id: Date.now().toString() + Math.random().toString(),
    timestamp: Date.now()
  };
  queue.push(newOp);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(operationId: string): void {
  const queue = getQueue().filter(op => op.id !== operationId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function hasQueuedOperations(): boolean {
  return getQueue().length > 0;
}

// Online status
export function isOnline(): boolean {
  return navigator.onLine;
}
