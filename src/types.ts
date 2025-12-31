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
  is_completed: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  category: Category;
  due_date: string;
  due_date_color?: string;
  due_date_bg?: string;
  due_date_icon?: string;
  subtasks?: Subtask[];
  created_at?: string;
  updated_at?: string;
}

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  recordId?: string;
  data?: Partial<Task>;
  tempId?: string;
  timestamp: number;
}
