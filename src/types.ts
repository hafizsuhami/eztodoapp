export interface CategoryOption {
  id: string;
  name: string;
  color: string;
  order_index?: number;
}

export type CategoryId = string;
export type TaskStatus = 'today' | 'all' | 'completed' | 'shared';
export type ThemeName = keyof typeof import('./constants').THEME_PRESETS;

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
  category: CategoryId;
  due_date: string;
  due_date_color?: string;
  due_date_bg?: string;
  due_date_icon?: string;
  subtasks?: Subtask[];
  reminder_at?: string; // ISO timestamp for reminder notification
  reminder_sent?: boolean; // Whether the reminder has been sent
  order_index?: number; // For manual ordering within groups
  created_at?: string;
  updated_at?: string;
  // Sharing metadata (populated when fetching)
  is_shared_with_me?: boolean;
  shared_by?: {
    id: string;
    name: string;
    avatar: string;
  };
}

// Share types
export type ShareStatus = 'pending' | 'accepted' | 'revoked';
export type SharePermission = 'view' | 'edit';

export interface TaskShare {
  id: string;
  task_id: string;
  owner_id: string;
  shared_with_id: string | null;
  shared_with_email: string | null;
  share_token: string | null;
  permission: SharePermission;
  status: ShareStatus;
  created_at: string;
  accepted_at: string | null;
  expires_at: string | null;
}

export interface TaskShareWithUser extends TaskShare {
  shared_user?: {
    id: string;
    email: string;
    name: string;
    avatar: string;
  };
}

export interface ShareLinkResponse {
  share_id: string;
  share_token: string;
  share_url: string;
  expires_at: string | null;
}

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  recordId?: string;
  data?: Partial<Task>;
  tempId?: string;
  timestamp: number;
}
