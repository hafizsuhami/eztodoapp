import { Category } from './types';

// DEPRECATED: INITIAL_TASKS is no longer used.
// Tasks are now stored in PocketBase and fetched via useTasks hook.
// Keeping for reference only.
/*
export const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'Finish UI Design Plan',
    isCompleted: false,
    category: Category.Work,
    dueDate: 'Today',
    dueDateColor: 'text-red-500',
    dueDateBg: 'bg-red-500/10',
    dueDateIcon: 'calendar_today',
    subtasks: [
      { id: '1-1', title: 'Create wireframes', isCompleted: true },
      { id: '1-2', title: 'Review with team', isCompleted: false },
      { id: '1-3', title: 'Finalize high-fidelity mocks', isCompleted: false }
    ]
  },
  {
    id: '2',
    title: 'Buy Groceries',
    isCompleted: false,
    category: Category.Personal,
    dueDate: 'Tomorrow',
    dueDateColor: 'text-orange-500',
    dueDateBg: 'bg-orange-500/10',
    dueDateIcon: 'event',
    subtasks: [
      { id: '2-1', title: 'Milk', isCompleted: false },
      { id: '2-2', title: 'Eggs', isCompleted: false }
    ]
  },
  {
    id: '3',
    title: 'Schedule Dentist Appointment',
    isCompleted: false,
    category: Category.Health,
    dueDate: 'No Due Date',
    dueDateColor: 'text-slate-500 dark:text-slate-400',
    dueDateBg: 'bg-slate-100 dark:bg-slate-800',
    dueDateIcon: 'schedule'
  },
  {
    id: '4',
    title: 'Review Q3 Goals',
    isCompleted: true,
    category: Category.Work,
    dueDate: 'Completed Yesterday',
    dueDateColor: 'text-slate-400',
    dueDateBg: '',
    dueDateIcon: 'check_circle'
  },
  {
    id: '5',
    title: 'Call Mom',
    isCompleted: false,
    category: Category.Family,
    dueDate: 'Sunday',
    dueDateColor: 'text-slate-500 dark:text-slate-400',
    dueDateBg: 'bg-slate-100 dark:bg-slate-800',
    dueDateIcon: 'calendar_month'
  }
];
*/

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.Work]: 'bg-blue-500',
  [Category.Personal]: 'bg-green-500',
  [Category.Health]: 'bg-pink-500',
  [Category.Family]: 'bg-purple-500',
};