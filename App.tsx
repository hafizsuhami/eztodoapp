import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { TaskCard } from './components/TaskCard';
import { AddTaskModal } from './components/AddTaskModal';
import { LoginModal } from './components/LoginModal';
import { Task, Category, TaskStatus, Subtask } from './types';
import { useAuth } from './hooks/useAuth';
import { useTasks } from './hooks/useTasks';

export default function App() {
  const { user, loading: authLoading, isAuthenticated, loginWithGoogle, logout } = useAuth();
  const { 
    tasks, 
    loading: tasksLoading, 
    syncStatus,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    updateTaskCategory,
    updateSubtasks
  } = useTasks(user?.id);

  const [activeTab, setActiveTab] = useState<TaskStatus>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Computed Values
  const activeCount = tasks.filter(t => !t.isCompleted).length;

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 1. Status Filter
      if (activeTab === 'active' && task.isCompleted) return false;
      if (activeTab === 'completed' && !task.isCompleted) return false;

      // 2. Category Filter
      if (categoryFilter && task.category !== categoryFilter) return false;

      // 3. Search Filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return task.title.toLowerCase().includes(query) || 
               task.category.toLowerCase().includes(query) ||
               task.subtasks?.some(s => s.title.toLowerCase().includes(query));
      }

      return true;
    });
  }, [tasks, activeTab, categoryFilter, searchQuery]);

  // Handlers
  const handleToggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      toggleTask(id, task.isCompleted);
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const updatedSubtasks = task.subtasks.map(s => 
        s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
      );
      updateSubtasks(taskId, updatedSubtasks);
    }
  };

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    if (window.confirm("Are you sure you want to delete this subtask?")) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.subtasks) {
        const updatedSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
        updateSubtasks(taskId, updatedSubtasks);
      }
    }
  };

  const handleUpdateSubtaskTitle = (taskId: string, subtaskId: string, newTitle: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.subtasks) {
      const updatedSubtasks = task.subtasks.map(s => 
        s.id === subtaskId ? { ...s, title: newTitle } : s
      );
      updateSubtasks(taskId, updatedSubtasks);
    }
  };

  const handleUpdateTaskCategory = (taskId: string, newCategory: Category) => {
    updateTaskCategory(taskId, newCategory);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
  };

  const handleEditTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      const newTitle = prompt("Update task title:", task.title);
      if (newTitle === null) {
        return;
      }

      // Handle Subtasks Edit
      const currentSubtasksStr = task.subtasks?.map(s => s.title).join(', ') || '';
      const newSubtasksStr = prompt("Update subtasks (comma separated):", currentSubtasksStr);
      
      let updatedSubtasks = task.subtasks || [];
      if (newSubtasksStr !== null && newSubtasksStr !== currentSubtasksStr) {
        // Simple reconstruction of subtasks if changed
        updatedSubtasks = newSubtasksStr.split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(title => ({
            id: Date.now().toString() + Math.random().toString(),
            title,
            isCompleted: false
          }));
      }

      if (newTitle.trim() !== "") {
        updateTask(id, { 
          title: newTitle.trim(),
          subtasks: updatedSubtasks
        });
      }
    }
  };

  const handleSaveNewTask = (title: string, subtaskTitles: string[]) => {
    const subtasks: Subtask[] = subtaskTitles.map(s => ({
      id: Date.now().toString() + Math.random().toString(),
      title: s,
      isCompleted: false
    }));

    createTask({
      title,
      isCompleted: false,
      category: Category.Personal, // Default
      dueDate: "No Due Date",
      dueDateColor: "text-slate-500",
      subtasks
    });
  };

  const clearFilters = () => {
    setCategoryFilter(null);
    setSearchQuery('');
    setActiveTab('all');
  };

  // Show loading spinner during initial auth check
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#111722]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Get user's first name for greeting
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <>
      <Header user={user} syncStatus={syncStatus} onLogout={logout} />
      
      {/* Login Modal */}
      <LoginModal 
        isOpen={!isAuthenticated} 
        onLogin={loginWithGoogle}
      />

      <main className="flex flex-1 justify-center py-6 px-4 md:px-8">
        <div className="flex flex-col max-w-[800px] w-full gap-6">
          
          {/* Heading & Summary */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white">
                Good Morning, {firstName}
              </h1>
              <p className="text-slate-500 dark:text-[#92a4c9] text-base font-medium">
                You have {activeCount} active tasks today
              </p>
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 overflow-hidden rounded-xl h-12 px-6 bg-primary hover:bg-primary/90 transition-all active:scale-95 text-white text-base font-bold shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="truncate">Add New Task</span>
            </button>
          </div>

          {/* Loading State */}
          {tasksLoading && tasks.length === 0 && (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">
                progress_activity
              </span>
            </div>
          )}

          {/* Filters & Search */}
          {!tasksLoading && (
            <div className="flex flex-col gap-4">
              {/* Top Filter Row: Tabs & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-200 dark:border-[#324467] gap-4">
                
                {/* Tabs */}
                <div className="flex w-full sm:w-auto overflow-x-auto no-scrollbar gap-8 px-2">
                  {(['all', 'active', 'completed'] as TaskStatus[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`group flex flex-col items-center justify-center border-b-[3px] pb-3 transition-colors cursor-pointer min-w-[60px] ${
                        activeTab === tab 
                          ? 'border-b-primary text-primary dark:text-white' 
                          : 'border-b-transparent text-slate-500 dark:text-[#92a4c9] hover:text-primary'
                      }`}
                    >
                      <p className="text-sm font-bold leading-normal tracking-[0.015em] capitalize">
                        {tab}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 pb-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                      search
                    </span>
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-[#1e293b] text-slate-900 dark:text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary border-none placeholder-slate-400 transition-shadow" 
                      placeholder="Search tasks..." 
                    />
                  </div>
                  <button className="p-2 text-slate-500 dark:text-[#92a4c9] hover:bg-slate-200 dark:hover:bg-[#232f48] rounded-lg transition-colors sm:hidden">
                    <span className="material-symbols-outlined">filter_list</span>
                  </button>
                </div>
              </div>

              {/* Chips (Categories) */}
              <div className="flex gap-3 flex-wrap items-center">
                <span className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider mr-1">
                  Filter by:
                </span>
                
                {Object.values(Category).map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                    className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg pl-3 pr-2 transition-colors ${
                      categoryFilter === cat 
                        ? 'bg-slate-200 dark:bg-[#2d3b55] text-slate-800 dark:text-white' 
                        : 'border border-slate-200 dark:border-[#232f48] hover:bg-slate-100 dark:hover:bg-[#1e293b] text-slate-500 dark:text-[#92a4c9]'
                    }`}
                  >
                    <p className="text-sm font-medium leading-normal">{cat}</p>
                    {categoryFilter === cat && (
                      <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[18px]">
                        close
                      </span>
                    )}
                  </button>
                ))}

                {(categoryFilter || searchQuery || activeTab !== 'all') && (
                  <button 
                    onClick={clearFilters}
                    className="ml-auto text-primary text-sm font-medium hover:underline hidden sm:block"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Task List Container */}
          <div className="flex flex-col gap-3 pb-20">
            {filteredTasks.length === 0 && !tasksLoading ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                <p>No tasks found.</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onToggle={() => handleToggleTask(task.id)}
                  onToggleSubtask={handleToggleSubtask}
                  onDelete={() => handleDeleteTask(task.id)}
                  onDeleteSubtask={handleDeleteSubtask}
                  onEdit={handleEditTask}
                  onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                  onUpdateCategory={handleUpdateTaskCategory}
                />
              ))
            )}
          </div>

        </div>
      </main>

      <AddTaskModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNewTask}
      />
    </>
  );
}
