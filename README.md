# TaskMaster - Task Management Dashboard

A modern task management app built with **Vue 3** + **TypeScript** + **Tailwind CSS**, with **Supabase** backend for authentication and real-time sync.

## Features

- Google OAuth authentication
- Create, edit, delete tasks with subtasks
- Categorize tasks (Work, Personal, Health, Family)
- Filter by status (All, Active, Completed) and category
- Search tasks
- Real-time sync across devices
- Offline support with localStorage queue
- Sync status indicator
- Dark mode UI

## Tech Stack

| Frontend | Backend |
|----------|---------|
| Vue 3.5 (Composition API) | Supabase (PostgreSQL) |
| TypeScript | Supabase Auth (Google OAuth) |
| Tailwind CSS | Supabase Realtime |
| Vite 6 | Row Level Security |
| Radix Vue | |

## Project Structure

```
├── src/
│   ├── main.ts                 # Vue entry point
│   ├── App.vue                 # Main app component
│   ├── style.css               # Tailwind styles
│   ├── types.ts                # TypeScript interfaces
│   ├── constants.ts            # Category colors
│   ├── lib/utils.ts            # cn() utility
│   ├── services/
│   │   ├── supabase.ts         # Supabase client
│   │   └── offlineQueue.ts     # Offline sync queue
│   ├── composables/
│   │   ├── useAuth.ts          # Authentication composable
│   │   └── useTasks.ts         # Tasks CRUD composable
│   └── components/
│       ├── Header.vue
│       ├── TaskCard.vue
│       ├── AddTaskModal.vue
│       ├── LoginModal.vue
│       └── SyncIndicator.vue
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── AGENTS.md                   # AI agent instructions
```

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Google OAuth credentials (for authentication)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings** → **API** and copy:
   - Project URL → `VITE_SUPABASE_URL`
   - anon/public key → `VITE_SUPABASE_ANON_KEY`

### 3. Create Environment File

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database

Go to **SQL Editor** in Supabase Dashboard and run:

```sql
-- Create tasks table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  is_completed boolean default false,
  category text check (category in ('Work', 'Personal', 'Health', 'Family')),
  due_date text,
  due_date_color text,
  due_date_bg text,
  due_date_icon text,
  subtasks jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.tasks enable row level security;

-- RLS Policies (users can only access their own tasks)
create policy "Users can view own tasks"
  on public.tasks for select using (auth.uid() = user_id);

create policy "Users can create own tasks"
  on public.tasks for insert with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete using (auth.uid() = user_id);

-- Enable real-time for tasks table
alter publication supabase_realtime add table public.tasks;
```

### 5. Configure Google OAuth

#### In Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

#### In Supabase Dashboard:

1. Go to **Authentication** → **Providers** → **Google**
2. Toggle **Enable Google**
3. Paste your **Client ID** and **Client Secret**
4. Save

### 6. Start Dev Server

```bash
npm run dev
```

App runs on http://localhost:5173

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Database Schema

### Tasks Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `user_id` | uuid | Foreign key to auth.users |
| `title` | text | Task title (required) |
| `is_completed` | boolean | Completion status |
| `category` | text | Work, Personal, Health, or Family |
| `due_date` | text | Due date display text |
| `due_date_color` | text | Tailwind color class |
| `due_date_bg` | text | Tailwind background class |
| `due_date_icon` | text | Material icon name |
| `subtasks` | jsonb | Array of subtask objects |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### Subtask Structure (JSON)

```json
{
  "id": "string",
  "title": "string",
  "is_completed": boolean
}
```

## Row Level Security

All tasks are protected by RLS policies:

| Operation | Policy |
|-----------|--------|
| SELECT | `auth.uid() = user_id` |
| INSERT | `auth.uid() = user_id` |
| UPDATE | `auth.uid() = user_id` |
| DELETE | `auth.uid() = user_id` |

Users can only access their own tasks.

## Real-time Subscriptions

The app uses Supabase Realtime to sync changes across devices:

```typescript
supabase
  .channel('tasks-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${userId}`
  }, handleChange)
  .subscribe();
```

## Offline Support

When offline:
1. Changes are queued in localStorage
2. UI updates optimistically
3. Queue is processed when back online
4. Sync status indicator shows current state

## License

MIT
