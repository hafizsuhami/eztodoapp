import React from 'react';
import { AuthUser } from '../hooks/useAuth';
import { SyncStatus } from '../hooks/useTasks';
import { SyncIndicator } from './SyncIndicator';

interface HeaderProps {
  user?: AuthUser | null;
  syncStatus?: SyncStatus;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, syncStatus = 'synced', onLogout }) => {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-[#232f48] px-4 md:px-10 py-3 bg-white dark:bg-[#111722] sticky top-0 z-50">
      <div className="flex items-center gap-4 text-slate-900 dark:text-white">
        <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
          <span className="material-symbols-outlined">check_circle</span>
        </div>
        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">TaskMaster</h2>
      </div>
      <div className="flex flex-1 justify-end items-center gap-4">
        {/* Sync Status Indicator */}
        <SyncIndicator status={syncStatus} />

        {/* User Profile */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {user.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
            </div>
            
            <div className="relative group">
              <div 
                className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-slate-200 dark:ring-[#232f48] cursor-pointer" 
                title={user.name}
                style={{
                  backgroundImage: user.avatar 
                    ? `url("${user.avatar}")` 
                    : 'url("https://picsum.photos/64/64")',
                }}
              >
              </div>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-3 border-b border-slate-100 dark:border-slate-700 sm:hidden">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
