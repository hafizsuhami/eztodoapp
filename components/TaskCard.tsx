import React, { useState, useRef, useEffect } from 'react';
import { Task, Category } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onUpdateSubtaskTitle: (taskId: string, subtaskId: string, newTitle: string) => void;
  onUpdateCategory: (taskId: string, newCategory: Category) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onToggle, 
  onDelete, 
  onEdit, 
  onToggleSubtask, 
  onDeleteSubtask, 
  onUpdateSubtaskTitle,
  onUpdateCategory
}) => {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryColor = CATEGORY_COLORS[task.category] || 'bg-slate-500';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    };

    if (isCategoryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryOpen]);

  const handleDeleteClick = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete();
    }
  };

  return (
    <div 
      className={`group flex flex-col sm:flex-row sm:items-start p-4 rounded-xl border transition-all duration-200 ease-in-out
      ${task.isCompleted 
        ? 'bg-slate-50 dark:bg-[#161f30] border-transparent hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100' 
        : `bg-white dark:bg-[#1e293b] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] ${isCategoryOpen ? 'z-20' : 'hover:z-10'}`
      }`}
    >
      <div className="flex items-start gap-4 flex-1 w-full">
        {/* Checkbox */}
        <label className="relative flex items-center p-0 mt-1 cursor-pointer shrink-0">
          <input 
            type="checkbox" 
            checked={task.isCompleted}
            onChange={onToggle}
            className="custom-checkbox peer sr-only" 
          />
          <div className="size-6 border-2 border-slate-300 dark:border-slate-500 rounded-md bg-transparent flex items-center justify-center transition-colors hover:border-primary">
            <svg className="w-4 h-4 text-white hidden pointer-events-none" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </div>
        </label>

        <div className="flex flex-col gap-1 w-full min-w-0">
          <div className="flex flex-wrap justify-between gap-2">
            <span className={`text-base font-semibold transition-colors decoration-2 truncate pr-2 ${
              task.isCompleted 
                ? 'line-through text-slate-500 dark:text-slate-400' 
                : 'text-slate-900 dark:text-white'
            }`}>
              {task.title}
            </span>
            
            {/* Mobile Actions */}
            <span className="flex sm:hidden ml-auto gap-2 shrink-0">
               <button onClick={() => onEdit(task.id)} className="text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">edit</span>
               </button>
               <button onClick={handleDeleteClick} className="text-slate-400 hover:text-red-500">
                <span className="material-symbols-outlined text-[20px]">delete</span>
               </button>
            </span>
          </div>
          
          {/* Subtasks List */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="flex flex-col gap-2 mt-1 mb-2">
              {task.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-2 group/subtask w-full">
                  <label className="relative flex items-center p-0 cursor-pointer shrink-0">
                      <input
                          type="checkbox"
                          checked={subtask.isCompleted}
                          onChange={() => onToggleSubtask(task.id, subtask.id)}
                          className="custom-checkbox peer sr-only"
                      />
                      <div className="size-4 border-2 border-slate-300 dark:border-slate-600 rounded bg-transparent flex items-center justify-center transition-colors hover:border-primary peer-checked:bg-primary peer-checked:border-primary">
                          <svg className="w-3 h-3 text-white hidden pointer-events-none peer-checked:block" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                      </div>
                  </label>
                  <input
                    type="text"
                    value={subtask.title}
                    onChange={(e) => onUpdateSubtaskTitle(task.id, subtask.id, e.target.value)}
                    className={`flex-1 min-w-0 text-sm leading-tight bg-transparent border-none p-0 focus:ring-0 focus:outline-none cursor-text transition-colors ${
                      subtask.isCompleted 
                      ? 'line-through text-slate-400 dark:text-slate-500' 
                      : 'text-slate-600 dark:text-slate-300'
                    }`}
                  />
                  <button 
                    onClick={() => onDeleteSubtask(task.id, subtask.id)}
                    className="ml-auto text-slate-400 hover:text-red-500 opacity-0 group-hover/subtask:opacity-100 transition-opacity p-0.5"
                    title="Delete subtask"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs mt-1">
            {/* Due Date Badge */}
            <span className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded ${task.dueDateBg || ''} ${task.dueDateColor || 'text-slate-500'}`}>
              <span className="material-symbols-outlined text-[14px]">{task.dueDateIcon || 'calendar_today'}</span>
              {task.dueDate}
            </span>

            {/* Category Badge */}
            <div className="relative" ref={categoryMenuRef}>
              <button
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className={`flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1.5 py-0.5 -ml-1.5 transition-colors ${task.isCompleted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}
                title="Change Category"
              >
                <span className={`size-2 rounded-full ${categoryColor} ${task.isCompleted ? 'opacity-50' : ''}`}></span>
                {task.category}
              </button>

              {isCategoryOpen && (
                <div className="absolute bottom-full mb-1 left-0 w-32 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col overflow-hidden">
                  {Object.values(Category).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        onUpdateCategory(task.id, cat);
                        setIsCategoryOpen(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 ${task.category === cat ? 'bg-slate-50 dark:bg-slate-800 font-medium text-primary' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      <span className={`size-2 rounded-full ${CATEGORY_COLORS[cat]}`}></span>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Subtask count badge (optional, for quick overview if collapsed, but visible here for detail) */}
            {task.subtasks && task.subtasks.length > 0 && (
               <span className="flex items-center gap-1 text-slate-400">
                  <span className="material-symbols-outlined text-[14px]">checklist</span>
                  {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
               </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Actions */}
      <div className="hidden sm:flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity self-center">
        <button 
          className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-primary transition-colors" 
          title="Edit"
          onClick={() => onEdit(task.id)}
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
        <button 
          onClick={handleDeleteClick}
          className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2d3b55] hover:text-red-500 transition-colors" 
          title="Delete"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
      </div>
    </div>
  );
};