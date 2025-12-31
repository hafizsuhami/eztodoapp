import { Category } from './types';

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.Work]: 'bg-blue-500',
  [Category.Personal]: 'bg-green-500',
  [Category.Health]: 'bg-pink-500',
  [Category.Family]: 'bg-purple-500',
};
