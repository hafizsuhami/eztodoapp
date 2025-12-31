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
  // This helps us style specific dates like "Today" vs generic dates
  dueDateColor?: string; 
  dueDateBg?: string;
  dueDateIcon?: string;
  subtasks?: Subtask[];
}