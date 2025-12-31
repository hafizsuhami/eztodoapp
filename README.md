# TaskMaster - Task Management Dashboard

A modern task management app built with **Vue 3** + **TypeScript** + **Tailwind CSS**, with **Supabase** backend for authentication and real-time sync.

## Features

- Google OAuth authentication
- Create, edit, delete tasks with subtasks
- **Dynamic categories** - Create, rename, recolor, and delete your own categories
- Filter by status (All, Active, Completed) and category
- Search tasks
- Real-time sync across devices
- Offline support with localStorage queue
- Sync status indicator
- **Multiple theme presets** (Light, Dark, Dim, Sepia, Vibrant Purple, Blush, Playful Kids)
- Voice input for task titles

## Tech Stack

| Frontend | Backend |
|----------|---------|
| Vue 3.5 (Composition API) | Supabase (PostgreSQL) |
| TypeScript | Supabase Auth (Google OAuth) |
| Tailwind CSS | Supabase Realtime |
| Vite 6 | Row Level Security |

## Project Structure

```
├── src/
│   ├── main.ts                 # Vue entry point
│   ├── App.vue                 # Main app component
│   ├── style.css               # Tailwind styles
│   ├── types.ts                # TypeScript interfaces
│   ├── constants.ts            # Theme presets, default categories, colors
│   ├── lib/utils.ts            # cn() utility
│   ├── services/
│   │   ├── supabase.ts         # Supabase client
│   │   └── offlineQueue.ts     # Offline sync queue
│   ├── composables/
│   │   ├── useAuth.ts          # Authentication composable
│   │   ├── useTasks.ts         # Tasks CRUD composable
│   │   ├── useCategories.ts    # Categories CRUD composable
│   │   └── useTheme.ts         # Theme management composable
│   └── components/
│       ├── Header.vue
│       ├── TaskCard.vue
│       ├── AddTaskModal.vue
│       ├── EditTaskModal.vue
│       ├── LoginModal.vue
│       ├── ConfirmModal.vue
│       ├── CategoryManagerModal.vue
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

- Node.js 18+ (or Bun)
- Supabase account (free tier works)
- Google OAuth credentials (for authentication)

### 1. Install Dependencies

```bash
bun install
# or
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
-- =====================
-- TASKS TABLE
-- =====================
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  category TEXT,  -- References category ID (no constraint, allows dynamic categories)
  due_date TEXT,
  due_date_color TEXT,
  due_date_bg TEXT,
  due_date_icon TEXT,
  subtasks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own tasks)
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.tasks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Enable real-time for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;


-- =====================
-- CATEGORIES TABLE
-- =====================
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only manage their own categories)
CREATE POLICY "Users can manage own categories"
  ON public.categories FOR ALL USING (auth.uid() = user_id);

-- Enable real-time for categories table
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
```

#### If Upgrading from Old Schema (with category check constraint)

If you previously had a `tasks_category_check` constraint, remove it:

```sql
-- Remove the old category check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
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
bun run dev
# or
npm run dev
```

App runs on http://localhost:5173

## NPM Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |

## Database Schema

### Tasks Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `user_id` | uuid | Foreign key to auth.users |
| `title` | text | Task title (required) |
| `is_completed` | boolean | Completion status |
| `category` | text | Category ID (references categories.id) |
| `due_date` | text | Due date display text |
| `due_date_color` | text | Tailwind color class |
| `due_date_bg` | text | Tailwind background class |
| `due_date_icon` | text | Material icon name |
| `subtasks` | jsonb | Array of subtask objects |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### Categories Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `user_id` | uuid | Foreign key to auth.users |
| `name` | text | Category name (e.g., "Work") |
| `color` | text | Hex color code (e.g., "#3B82F6") |
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

## Dynamic Categories

New users are automatically seeded with 4 default categories:
- **Work** (Blue)
- **Personal** (Green)
- **Health** (Pink)
- **Family** (Purple)

Users can:
- **Rename** categories
- **Change colors** (10 pastel color options)
- **Create** new categories
- **Delete** categories (only if no active tasks use them, or all tasks using them are completed)

## Row Level Security

All data is protected by RLS policies:

| Table | Policy |
|-------|--------|
| tasks | Users can only CRUD their own tasks |
| categories | Users can only CRUD their own categories |

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

## Theme System

7 built-in theme presets:
- Light (default)
- Dark
- Dim
- Sepia
- Vibrant Purple
- Blush
- Playful Kids

Theme preference is saved to:
1. Supabase user metadata (synced across devices)
2. localStorage (fallback for offline)

## License

MIT
