# AGENTS.md - Coding Agent Instructions

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

- **Name**: TaskMaster - Task Management Dashboard
- **Type**: React 19 SPA with TypeScript
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS (via CDN)
- **Module System**: ES Modules

## Build/Dev Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (port 3000)
bun run build        # Production build
bun run preview      # Preview production build
```

## Testing

No testing framework configured. When adding tests, use Vitest or Jest with `.test.ts`/`.test.tsx` suffix.

## Linting & Formatting

No linting tools configured. Maintain consistency:
- 2-space indentation
- Single quotes for strings, double quotes for JSX attributes
- Always use semicolons
- No trailing commas

## Project Structure

```
/
├── components/           # React UI components (PascalCase filenames)
├── App.tsx               # Main application component with state
├── index.tsx             # React entry point
├── types.ts              # TypeScript interfaces and types
├── constants.ts          # App constants and initial data
└── vite.config.ts        # Vite build configuration
```

## Code Style Guidelines

### Imports

Organize in order: React core > local components > types > constants
```typescript
import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Task, Category } from './types';
import { INITIAL_TASKS } from './constants';
```

### Naming Conventions

| Element          | Convention         | Examples                              |
|------------------|--------------------|---------------------------------------|
| Files            | PascalCase (components), camelCase (utilities) | `TaskCard.tsx`, `types.ts` |
| Components       | PascalCase         | `TaskCard`, `AddTaskModal`            |
| Interfaces/Types | PascalCase         | `Task`, `TaskCardProps`               |
| Enums            | PascalCase         | `Category.Work`                       |
| Functions        | camelCase          | `handleToggleTask`, `clearFilters`    |
| Event handlers   | `handle` prefix    | `handleDeleteClick`                   |
| Constants        | UPPER_SNAKE_CASE   | `INITIAL_TASKS`                       |

### TypeScript Patterns

```typescript
// Named export with React.FC
interface TaskCardProps {
  task: Task;
  onToggle: () => void;
}
export const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle }) => { };

// Default export for App only
export default function App() { }

// State with generics
const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

// Enums for categorical data
export enum Category { Work = 'Work', Personal = 'Personal' }

// Type aliases for unions
export type TaskStatus = 'all' | 'active' | 'completed';
```

### Error Handling

```typescript
// Critical errors - throw
if (!rootElement) throw new Error("Could not find root element");

// User confirmations
if (window.confirm('Are you sure?')) onDelete();

// Guard clauses with early returns
if (!title.trim()) return;
if (!isOpen) return null;
```

### React Patterns

```typescript
// Functional state updates
setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));

// Memoization
const filteredTasks = useMemo(() => tasks.filter(/*...*/), [tasks, activeTab]);

// useEffect cleanup
useEffect(() => {
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isCategoryOpen]);
```

### Styling with Tailwind

Use utility classes inline; support dark mode with `dark:` variant:
```typescript
className={`text-base font-semibold ${
  task.isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'
}`}
```

Common colors: `bg-white`/`dark:bg-[#1e293b]`, `text-slate-900`/`dark:text-white`

### Icons

Use Google Material Symbols Outlined:
```tsx
<span className="material-symbols-outlined text-[20px]">add</span>
```

## Common Patterns

```typescript
// Generating IDs
const id = Date.now().toString() + Math.random().toString();

// Immutable array updates
setTasks([newTask, ...tasks]);                              // Add to beginning
setTasks(prev => prev.filter(t => t.id !== id));            // Filter out
setTasks(prev => prev.map(t => t.id === id ? {...t, ...updates} : t)); // Update
```

## TypeScript Configuration

- Target: ES2022, JSX: react-jsx, Module: ESNext
- Path alias `@/*` maps to `./*` (prefer relative paths)
- Strict mode not enabled - be explicit with types

## Environment Variables

- `GEMINI_API_KEY` in `.env.local` - never commit to version control
