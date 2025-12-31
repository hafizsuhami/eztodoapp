import { ref, readonly } from 'vue';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

const toasts = ref<Toast[]>([]);

let idCounter = 0;

export function useToast() {
  const addToast = (
    message: string,
    type: Toast['type'] = 'info',
    options?: { duration?: number; action?: Toast['action'] }
  ): string => {
    const id = `toast-${++idCounter}`;
    const duration = options?.duration ?? 4000;

    const toast: Toast = {
      id,
      message,
      type,
      duration,
      action: options?.action
    };

    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  const success = (message: string, options?: { duration?: number; action?: Toast['action'] }) =>
    addToast(message, 'success', options);

  const error = (message: string, options?: { duration?: number; action?: Toast['action'] }) =>
    addToast(message, 'error', options);

  const warning = (message: string, options?: { duration?: number; action?: Toast['action'] }) =>
    addToast(message, 'warning', options);

  const info = (message: string, options?: { duration?: number; action?: Toast['action'] }) =>
    addToast(message, 'info', options);

  return {
    toasts: readonly(toasts),
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
}
