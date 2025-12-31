export enum Category {
  Work = 'Work',
  Personal = 'Personal',
  Health = 'Health',
  Family = 'Family'
}

export type TaskStatus = 'all' | 'active' | 'completed';

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  user: string;
  title: string;
  isCompleted: boolean;
  category: Category;
  dueDate: string;
  dueDateColor?: string;
  dueDateBg?: string;
  dueDateIcon?: string;
  subtasks?: Subtask[];
}

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  recordId?: string;
  data?: Partial<Task>;
  tempId?: string;
  timestamp: number;
}
