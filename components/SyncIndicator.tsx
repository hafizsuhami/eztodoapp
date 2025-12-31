import React from 'react';
import { SyncStatus } from '../hooks/useTasks';

interface SyncIndicatorProps {
  status: SyncStatus;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ status }) => {
  if (status === 'synced') return null;

  const config = {
    syncing: {
      icon: 'sync',
      text: 'Syncing...',
      className: 'text-blue-500 animate-spin'
    },
    offline: {
      icon: 'cloud_off',
      text: 'Offline',
      className: 'text-amber-500'
    },
    error: {
      icon: 'error',
      text: 'Sync error',
      className: 'text-red-500'
    }
  };

  const { icon, text, className } = config[status];

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      <span className={`material-symbols-outlined text-[16px] ${className}`}>
        {icon}
      </span>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {text}
      </span>
    </div>
  );
};
