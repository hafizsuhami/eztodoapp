# Feature Roadmap: Task Sharing

> **Date**: January 2026
> **Status**: ✅ Implemented (v1.0.2)
> **Commitment Level**: Bet

---

## Executive Summary

This document outlines the strategic and technical roadmap for adding task sharing functionality to TaskMaster. Based on analysis from both strategic (CEO) and technical (CTO) perspectives, the recommendation is to **start with read-only link-based sharing** as a minimal experiment before investing in full collaboration features.

---

## Table of Contents

1. [Strategic Assessment](#strategic-assessment)
2. [Types of Sharing](#types-of-sharing)
3. [Recommended Approach](#recommended-approach)
4. [Technical Architecture](#technical-architecture)
5. [Database Schema](#database-schema)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Real-time Considerations](#real-time-considerations)
8. [Offline Sync Strategy](#offline-sync-strategy)
9. [Frontend Implementation](#frontend-implementation)
10. [Implementation Timeline](#implementation-timeline)
11. [Risks and Mitigations](#risks-and-mitigations)
12. [Success Metrics](#success-metrics)

---

## Strategic Assessment

### Why Be Cautious

1. **Architecture Gap**: Current model is `user_id → tasks` (1:1). Sharing requires permission tables, RLS policy changes, and conflict resolution.

2. **Unclear User Demand**: Todo apps are personal by nature. Successful apps (Todoist, Things, TickTick) added sharing years into their lifecycle as a secondary feature.

3. **Competitive Landscape**: Collaboration is owned by Notion, Asana, Monday. Matching them dilutes focus.

4. **Offline Queue Complexity**: Current queue assumes single-user ownership. Multi-user editing requires conflict resolution (CRDT, operational transforms).

### Recommendation

**Don't build full collaboration yet.** If adding social features, start with **read-only list sharing via link** — not collaborative editing.

---

## Types of Sharing

| Type | Complexity | Use Case |
|------|------------|----------|
| **Link-based view-only** | Low | Share grocery list, trip itinerary |
| **Link-based with edit** | Medium | Partner can check off items |
| **User-based sharing** | Medium-High | Invite specific users by email |
| **Shared lists/projects** | High | Team task management |
| **Real-time collaboration** | Very High | Google Docs-style editing |

---

## Recommended Approach

### MVP: Read-Only Link Sharing

**What**: Generate a shareable link for a task. Viewer sees task in real-time but cannot edit.

**Why this approach**:
- No auth complexity for recipients (public link with UUID)
- No conflict resolution needed
- Minimal RLS changes
- Real use cases: sharing grocery list, packing list, trip itinerary
- Implementation time: days, not weeks

**What it teaches**: Whether users actually share, what they share, and if they ask for edit access.

---

## Technical Architecture

### Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Task Owner    │────▶│   task_shares   │◀────│   Recipient     │
│   (auth user)   │     │   (new table)   │     │ (via token URL) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Full CRUD +    │     │  Token-based    │     │  View only (MVP)│
│  Offline Sync   │     │  RPC functions  │     │  No offline     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Design Decisions

1. **Token-based over user-based**: No email lookup, no invite flow, simpler UX
2. **RPC functions for access**: Bypass RLS complexity with `SECURITY DEFINER` functions
3. **Polling over real-time**: Supabase Realtime + RLS is tricky for shared content
4. **No offline for shared tasks**: Avoids conflict resolution complexity

---

## Database Schema

### New Table: `task_shares`

```sql
CREATE TABLE task_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  share_token VARCHAR(32) NOT NULL UNIQUE,  -- Short URL-safe token
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  
  -- Optional: bind to specific user (for future user-based sharing)
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  
  -- Constraints
  CONSTRAINT unique_task_share UNIQUE (task_id, share_token)
);

-- Indexes for performance
CREATE INDEX idx_task_shares_token ON task_shares(share_token);
CREATE INDEX idx_task_shares_task_id ON task_shares(task_id);
CREATE INDEX idx_task_shares_user ON task_shares(shared_with_user_id) 
  WHERE shared_with_user_id IS NOT NULL;
```

### Schema Design Rationale

| Field | Purpose |
|-------|---------|
| `share_token` | 32-char random string for URLs like `/share/a7f3x9...` |
| `shared_with_user_id` | Optional — enables upgrade to user-based sharing later |
| `permission` | Simple view/edit. Don't overbuild permissions. |
| `expires_at` | Security escape hatch. NULL = permanent. |
| `ON DELETE CASCADE` | Cleaning up tasks automatically cleans shares |

---

## Row Level Security (RLS)

### Challenge

Current RLS is simple: `user_id = auth.uid()`. With sharing, we need three access paths:
1. Owner access (existing)
2. User-based shared access
3. Token-based access (anonymous)

### RLS Policies

```sql
-- 1. Owner can do everything (keep existing)
CREATE POLICY "task_owner_all" ON tasks
  FOR ALL USING (user_id = auth.uid());

-- 2. Users with share access can SELECT
CREATE POLICY "task_shared_select" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_shares 
      WHERE task_shares.task_id = tasks.id 
        AND task_shares.shared_with_user_id = auth.uid()
        AND (task_shares.expires_at IS NULL OR task_shares.expires_at > NOW())
    )
  );

-- 3. Users with EDIT permission can UPDATE (not delete!)
CREATE POLICY "task_shared_update" ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM task_shares 
      WHERE task_shares.task_id = tasks.id 
        AND task_shares.shared_with_user_id = auth.uid()
        AND task_shares.permission = 'edit'
        AND (task_shares.expires_at IS NULL OR task_shares.expires_at > NOW())
    )
  );
```

### Token-Based Access via RPC

RLS cannot check tokens passed in request headers. Use database functions:

```sql
-- Get shared task by token (for anonymous access)
CREATE OR REPLACE FUNCTION get_shared_task(p_share_token TEXT)
RETURNS SETOF tasks
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
AS $$
DECLARE
  v_task_id UUID;
BEGIN
  SELECT task_id INTO v_task_id
  FROM task_shares
  WHERE share_token = p_share_token
    AND (expires_at IS NULL OR expires_at > NOW());
    
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;
  
  RETURN QUERY SELECT * FROM tasks WHERE id = v_task_id;
END;
$$;

-- Update shared task by token (for edit permission)
CREATE OR REPLACE FUNCTION update_shared_task(
  p_share_token TEXT,
  p_updates JSONB
)
RETURNS tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_permission TEXT;
  v_result tasks;
BEGIN
  SELECT task_id, permission INTO v_task_id, v_permission
  FROM task_shares
  WHERE share_token = p_share_token
    AND (expires_at IS NULL OR expires_at > NOW());
    
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;
  
  IF v_permission != 'edit' THEN
    RAISE EXCEPTION 'No edit permission for this share link';
  END IF;
  
  -- Apply updates (whitelist allowed fields!)
  UPDATE tasks SET
    title = COALESCE(p_updates->>'title', title),
    is_completed = COALESCE((p_updates->>'is_completed')::boolean, is_completed),
    due_date = COALESCE(p_updates->>'due_date', due_date),
    subtasks = COALESCE((p_updates->'subtasks')::jsonb, subtasks)
  WHERE id = v_task_id
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;
```

---

## Real-time Considerations

### Current Architecture

```typescript
// useTasks.ts line 236-262
filter: `user_id=eq.${id}`
```

This only catches owned tasks. Shared tasks won't trigger updates.

### Problem

Supabase Realtime respects RLS. Anonymous users (token-based) won't receive updates through postgres_changes.

### Solutions

| Approach | Complexity | Recommendation |
|----------|------------|----------------|
| **Polling** | Low | Use for MVP. Poll every 30s. |
| **Broadcast channel** | Medium | Owner pushes changes manually |
| **Dual subscription** | Medium | Subscribe to specific task IDs |
| **Disable RLS for realtime** | N/A | Not recommended for security |

### MVP Implementation: Polling

```typescript
// In SharedTaskView.vue
const pollInterval = ref<number | null>(null);

onMounted(() => {
  // Initial fetch
  fetchSharedTask();
  
  // Poll every 30 seconds
  pollInterval.value = window.setInterval(fetchSharedTask, 30000);
});

onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
  }
});
```

---

## Offline Sync Strategy

### Why Skip Offline Sync for Shared Tasks

The current offline queue assumes **single-user ownership**. With shared tasks, multiple people can edit simultaneously, leading to conflicts:

```
Timeline:
─────────────────────────────────────────────────────
User A (offline):  Edits title to "Buy milk"
User B (online):   Edits title to "Buy groceries", marks complete
User A (online):   Tries to sync... What happens?
```

### Conflict Scenarios

| Scenario | Problem |
|----------|---------|
| Last-write-wins | Silent data loss |
| Subtask edits | Array merge conflicts |
| Delete conflicts | Orphaned data or errors |
| Queue ordering | Clock differences between devices |

### Proper Solutions (Complex)

1. **Operational Transforms (OT)** — Google Docs approach
2. **CRDTs** (Conflict-free Replicated Data Types) — Figma approach
3. **3-way merge** — Git-style conflict resolution

These require weeks to months of work.

### MVP Approach: Block Offline Edits

```typescript
const updateTask = async (taskId: string, data: Partial<Task>) => {
  const task = tasks.value.find(t => t.id === taskId);
  const isSharedTask = task && task.user_id !== userId();
  
  if (isSharedTask && !isOnline()) {
    showToast('Shared tasks require internet connection to edit');
    return; // Block the edit
  }
  
  // ... existing logic for owned tasks
};
```

**Why this is acceptable**:
- Users understand "you need internet for shared stuff"
- Viewing offline can still work (cache when online)
- Avoids complex merge logic
- Can add proper sync later if demand justifies it

### Future Enhancement Signals

| Signal | Action |
|--------|--------|
| Users complain about needing internet | Implement last-write-wins with warning |
| Power users want true collaboration | Invest in CRDT library (Yjs, Automerge) |
| Pivoting to team product | Rebuild with collaboration-first architecture |

---

## Frontend Implementation

### New Types

```typescript
// Add to types.ts
export interface TaskShare {
  id: string;
  task_id: string;
  share_token: string;
  permission: 'view' | 'edit';
  shared_with_user_id?: string;
  created_by: string;
  created_at: string;
  expires_at?: string;
}

export interface SharedTaskView {
  task: Task;
  permission: 'view' | 'edit';
  share_token: string;
}
```

### New Composable: `useTaskSharing.ts`

```typescript
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import type { Task, TaskShare, SharedTaskView } from '../types';

export function useTaskSharing(userId: () => string | undefined) {
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Generate a secure random token
  const generateToken = (length: number = 32): string => {
    const array = new Uint8Array(length / 2);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Create a share link for a task
  const createShareLink = async (
    taskId: string, 
    permission: 'view' | 'edit' = 'view',
    expiresInDays?: number
  ): Promise<string> => {
    const id = userId();
    if (!id) throw new Error('User not authenticated');

    const shareToken = generateToken(32);
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: insertError } = await supabase
      .from('task_shares')
      .insert({
        task_id: taskId,
        share_token: shareToken,
        permission,
        created_by: id,
        expires_at: expiresAt
      });

    if (insertError) throw insertError;
    
    return `${window.location.origin}/share/${shareToken}`;
  };

  // Get shared task by token (for recipients)
  const getSharedTask = async (shareToken: string): Promise<SharedTaskView> => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_shared_task', { p_share_token: shareToken });

      if (rpcError) throw rpcError;
      if (!data || data.length === 0) throw new Error('Task not found');

      // Get permission level
      const { data: share } = await supabase
        .from('task_shares')
        .select('permission')
        .eq('share_token', shareToken)
        .single();

      return {
        task: data[0],
        permission: share?.permission || 'view',
        share_token: shareToken
      };
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load shared task';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // Update shared task (requires edit permission)
  const updateSharedTask = async (
    shareToken: string, 
    updates: Partial<Task>
  ): Promise<Task> => {
    const { data, error: rpcError } = await supabase
      .rpc('update_shared_task', { 
        p_share_token: shareToken,
        p_updates: updates
      });

    if (rpcError) throw rpcError;
    return data;
  };

  // Get all shares for a task (for owner)
  const getTaskShares = async (taskId: string): Promise<TaskShare[]> => {
    const { data, error: fetchError } = await supabase
      .from('task_shares')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    return data || [];
  };

  // Revoke a share
  const revokeShare = async (shareId: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('task_shares')
      .delete()
      .eq('id', shareId);

    if (deleteError) throw deleteError;
  };

  // Revoke all shares for a task
  const revokeAllShares = async (taskId: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('task_shares')
      .delete()
      .eq('task_id', taskId);

    if (deleteError) throw deleteError;
  };

  return {
    loading,
    error,
    createShareLink,
    getSharedTask,
    updateSharedTask,
    getTaskShares,
    revokeShare,
    revokeAllShares
  };
}
```

### New Route: `/share/:token`

```typescript
// In router configuration
{
  path: '/share/:token',
  name: 'SharedTask',
  component: () => import('./components/SharedTaskView.vue'),
  props: true,
  meta: { requiresAuth: false }  // Public route
}
```

### Component: `ShareTaskModal.vue` (Sketch)

```vue
<template>
  <div class="modal">
    <h2>Share Task</h2>
    
    <!-- Permission selector -->
    <div class="permission-toggle">
      <label>
        <input type="radio" v-model="permission" value="view" />
        View only
      </label>
      <label>
        <input type="radio" v-model="permission" value="edit" />
        Can edit
      </label>
    </div>
    
    <!-- Generate link -->
    <button @click="generateLink" :disabled="loading">
      {{ shareLink ? 'Regenerate Link' : 'Generate Link' }}
    </button>
    
    <!-- Share link display -->
    <div v-if="shareLink" class="share-link">
      <input type="text" :value="shareLink" readonly />
      <button @click="copyLink">Copy</button>
    </div>
    
    <!-- Existing shares -->
    <div v-if="existingShares.length > 0" class="existing-shares">
      <h3>Active Shares</h3>
      <ul>
        <li v-for="share in existingShares" :key="share.id">
          {{ share.permission }} - Created {{ formatDate(share.created_at) }}
          <button @click="revoke(share.id)">Revoke</button>
        </li>
      </ul>
    </div>
  </div>
</template>
```

---

## Implementation Timeline

### Phase 0: Validate Demand (1-2 days)

- [ ] Add "Share" button to TaskCard
- [ ] Show "Coming soon — what would you share?" modal
- [ ] Track button clicks in analytics
- [ ] Collect user feedback

### Phase 1: Database Setup (Day 1)

- [ ] Create `task_shares` table in Supabase
- [ ] Add indexes for performance
- [ ] Create RPC functions (`get_shared_task`, `update_shared_task`)
- [ ] Test with SQL directly

### Phase 2: Backend Integration (Days 2-3)

- [ ] Create `useTaskSharing.ts` composable
- [ ] Add TypeScript types for sharing
- [ ] Implement token generation
- [ ] Test share creation and retrieval

### Phase 3: Owner UI (Days 3-4)

- [ ] Create `ShareTaskModal.vue`
- [ ] Add share button to TaskCard
- [ ] Implement copy-to-clipboard
- [ ] Show existing shares with revoke option

### Phase 4: Recipient View (Days 5-7)

- [ ] Create `/share/:token` route
- [ ] Create `SharedTaskView.vue` component
- [ ] Implement polling for updates
- [ ] Handle expired/invalid tokens gracefully

### Phase 5: Polish (Week 2)

- [ ] Add expiration date option
- [ ] Implement offline guards for shared tasks
- [ ] Add "Shared with me" section (if user-based sharing)
- [ ] Error handling and edge cases
- [ ] Loading states and skeleton UI

### Total Effort: **Milestone (2-3 weeks)**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Token enumeration** | Security breach | Use 32+ char tokens, rate-limit RPC |
| **Stale share links** | Privacy concern | Add `expires_at` with 30-day default |
| **Subtask conflicts** | Data inconsistency | Last-write-wins for MVP; no CRDT |
| **Category visibility** | Broken UI | Include category name in task response |
| **Offline edits** | Data conflicts | Block offline editing for shared tasks |
| **Scope creep** | Timeline slip | Hard boundary: view-only in v1 |
| **Performance** | Shared lists hammered | Add rate limiting for public routes |

---

## Success Metrics

### Experiment Success Criteria

| Metric | Target | Action if Met |
|--------|--------|---------------|
| Share button clicks | >10% of active users | Proceed with build |
| Shares created | >5% of users create 1+ share | Feature has value |
| Share link visits | >50% of shares get viewed | Distribution works |
| Edit requests | >15% of viewers request edit | Add edit capability |

### Kill Criteria

| Metric | Threshold | Action |
|--------|-----------|--------|
| Usage after 60 days | <5% | Deprecate feature |
| Support burden | High confusion/complaints | Simplify or remove |
| Security incidents | Any token abuse | Add stricter controls |

### Pivot Signals

- **Build more**: >15% of users share at least one task within 30 days
- **Kill it**: <5% usage after 60 days
- **Pivot to collaboration**: Consistent requests for "let my partner check off items"

---

## Future Considerations

### When to Revisit This Design

| Signal | Action |
|--------|--------|
| >5 shares per task | Consider share "groups" or workspace model |
| "Shared with me" as primary view | Add materialized view or denormalized flag |
| Collaboration conflicts | Invest in operational transforms or CRDT |
| Comments/activity requests | Add `task_activity` table |

### Alternative: User-Based Sharing Only

If all users have accounts and tighter control is needed:

```sql
CREATE TABLE task_shares (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id),
  permission VARCHAR(10) DEFAULT 'view',
  PRIMARY KEY (task_id, shared_with_user_id)
);
```

**Tradeoff**: Requires invite flow, email lookup, more UI complexity. Save for v2 when user demand data exists.

---

## Appendix: Quick Reference

### SQL Setup Script

```sql
-- Run in Supabase SQL Editor

-- 1. Create table
CREATE TABLE task_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  share_token VARCHAR(32) NOT NULL UNIQUE,
  permission VARCHAR(10) NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CONSTRAINT unique_task_share UNIQUE (task_id, share_token)
);

-- 2. Create indexes
CREATE INDEX idx_task_shares_token ON task_shares(share_token);
CREATE INDEX idx_task_shares_task_id ON task_shares(task_id);

-- 3. Enable RLS
ALTER TABLE task_shares ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for task_shares table
CREATE POLICY "Users can view their own shares" ON task_shares
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create shares for their tasks" ON task_shares
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own shares" ON task_shares
  FOR DELETE USING (created_by = auth.uid());
```

### File Checklist

- [ ] `src/types.ts` — Add `TaskShare`, `SharedTaskView` interfaces
- [ ] `src/composables/useTaskSharing.ts` — New composable
- [ ] `src/components/ShareTaskModal.vue` — New component
- [ ] `src/components/SharedTaskView.vue` — New component
- [ ] `src/components/TaskCard.vue` — Add share button
- [ ] Router config — Add `/share/:token` route

---

*Document maintained by: Development Team*  
*Last updated: January 2026*

---

# Feature Roadmap: Task Reminders (Push Notifications)

> **Date**: January 2026
> **Status**: ✅ Implemented (v1.0.2)
> **Commitment Level**: Bet

---

## Executive Summary

This document outlines the implementation of push notification reminders for tasks. Using OneSignal as the push notification provider, users can set reminders on tasks and receive notifications even when the app is closed. The feature includes full iOS PWA support detection with user guidance.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Technical Architecture](#technical-architecture)
3. [Platform Support](#platform-support)
4. [Implementation Details](#implementation-details)
5. [Setup Instructions](#setup-instructions)
6. [Database Schema](#database-schema)
7. [Edge Function](#edge-function)
8. [Frontend Components](#frontend-components)
9. [Future Enhancements](#future-enhancements)

---

## Feature Overview

### What Was Built

| Component | Description |
|-----------|-------------|
| **Reminder Fields** | `reminder_at` and `reminder_sent` added to Task type |
| **OneSignal Integration** | `usePushNotifications.ts` composable for subscription management |
| **Add Task Modal** | Reminder toggle with date/time picker |
| **Edit Task Modal** | Same reminder UI for editing existing tasks |
| **Task Card** | Purple reminder badge showing notification time |
| **iOS Install Prompt** | Bottom sheet prompting iOS users to install as PWA |
| **Edge Function** | `send-reminders` - checks due reminders & sends via OneSignal |
| **SQL Migration** | Adds reminder columns and index to tasks table |

### User Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User creates   │────▶│  Supabase saves │────▶│  pg_cron runs   │
│  task with      │     │  reminder_at    │     │  every minute   │
│  reminder       │     │  timestamp      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User receives  │◀────│  OneSignal      │◀────│  Edge Function  │
│  push           │     │  delivers       │     │  finds due      │
│  notification   │     │  notification   │     │  reminders      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Technical Architecture

### Why OneSignal?

| Option | Free Tier | Backend Needed | Complexity | Decision |
|--------|-----------|----------------|------------|----------|
| **Supabase + web-push** | 500K/month | Already have | Medium | Good option |
| **OneSignal** | 10K subscribers | None | Low | ✅ Chosen |
| **Firebase (FCM)** | Unlimited | Optional | Medium-High | Overkill |
| **Cloudflare Workers** | 100K/day | Built-in | Medium-High | Alternative |

**Rationale**: OneSignal provides the fastest path to working push notifications with minimal backend complexity. The free tier (10K subscribers) is sufficient for an indie app with "Buy Me a Coffee" business model.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vue 3)                           │
├─────────────────────────────────────────────────────────────────┤
│  usePushNotifications.ts                                        │
│  ├── Initialize OneSignal SDK                                   │
│  ├── Request notification permission                            │
│  ├── Detect iOS PWA requirements                                │
│  └── Set external user ID for targeting                         │
│                                                                 │
│  AddTaskModal.vue / EditTaskModal.vue                           │
│  ├── Reminder toggle switch                                     │
│  ├── Date picker                                                │
│  ├── Time picker                                                │
│  └── iOS install prompt (when needed)                           │
│                                                                 │
│  TaskCard.vue                                                   │
│  └── Reminder badge with formatted time                         │
│                                                                 │
│  IOSInstallPrompt.vue                                           │
│  └── Bottom sheet with PWA install instructions                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                   │
├─────────────────────────────────────────────────────────────────┤
│  tasks table                                                    │
│  ├── reminder_at: TIMESTAMPTZ                                   │
│  └── reminder_sent: BOOLEAN                                     │
│                                                                 │
│  pg_cron (every minute)                                         │
│  └── Calls Edge Function via HTTP                               │
│                                                                 │
│  Edge Function: send-reminders                                  │
│  ├── Query tasks WHERE reminder_at <= NOW() AND NOT sent        │
│  ├── Call OneSignal REST API for each                           │
│  └── Mark reminder_sent = true                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ONESIGNAL                                  │
├─────────────────────────────────────────────────────────────────┤
│  ├── Receives notification request via REST API                │
│  ├── Routes to appropriate push service (FCM, APNs, Mozilla)   │
│  └── Delivers to user's browser/device                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Platform Support

| Platform | Push Notifications | Notes |
|----------|-------------------|-------|
| **Desktop Chrome** | ✅ Works | No restrictions |
| **Desktop Firefox** | ✅ Works | No restrictions |
| **Desktop Edge** | ✅ Works | No restrictions |
| **Desktop Safari** | ✅ Works | macOS 13+ required |
| **Android Chrome** | ✅ Works | No restrictions |
| **Android Firefox** | ✅ Works | No restrictions |
| **iOS Safari (PWA)** | ✅ Works | iOS 16.4+, must install to Home Screen |
| **iOS Safari (browser)** | ❌ Limited | Shows install prompt |

### iOS Limitations

Apple only supports Web Push on iOS 16.4+ and **requires PWA installation**:

1. User must tap Share button
2. Select "Add to Home Screen"
3. Open app from Home Screen
4. Then grant notification permission

The `IOSInstallPrompt.vue` component guides users through this process.

---

## Implementation Details

### New Files Created

```
src/
├── composables/
│   └── usePushNotifications.ts    # OneSignal integration
├── components/
│   └── IOSInstallPrompt.vue       # PWA install guidance
supabase/
├── functions/
│   └── send-reminders/
│       └── index.ts               # Edge Function
└── migrations/
    └── 20260101_add_reminders.sql # Schema migration
```

### Modified Files

```
src/
├── types.ts                       # Added reminder_at, reminder_sent
├── App.vue                        # Import IOSInstallPrompt, update handlers
├── composables/
│   └── useTasks.ts                # Include reminder fields in createTask
├── components/
│   ├── AddTaskModal.vue           # Reminder picker UI
│   ├── EditTaskModal.vue          # Reminder picker UI
│   └── TaskCard.vue               # Reminder badge display
index.html                         # OneSignal SDK script
```

---

## Setup Instructions

### 1. OneSignal Configuration

1. Create account at [onesignal.com](https://onesignal.com)
2. Create a new app → Select "Web"
3. Configure your site:
   - Site URL: `https://ezytodo.com` (your domain)
   - Default notification icon: Upload your app icon
4. Copy your **App ID**

5. Add to `.env`:
```env
VITE_ONESIGNAL_APP_ID=your-onesignal-app-id
```

6. Get **REST API Key** from Settings → Keys & IDs

### 2. Supabase Database Migration

Run in Supabase SQL Editor:

```sql
-- Add reminder columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders 
  ON tasks(reminder_at) 
  WHERE reminder_at IS NOT NULL AND reminder_sent = false;
```

### 3. Deploy Edge Function

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set ONESIGNAL_APP_ID=your-app-id
supabase secrets set ONESIGNAL_REST_API_KEY=your-rest-api-key

# Deploy the function
supabase functions deploy send-reminders
```

### 4. Set Up pg_cron Scheduler

1. Enable pg_cron extension in Supabase Dashboard → Database → Extensions
2. Enable pg_net extension (for HTTP calls)
3. Run this SQL:

```sql
-- Schedule the reminder check every minute
SELECT cron.schedule(
  'check-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
```

### 5. Verify Setup

```bash
# Test the Edge Function manually
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{"message": "No reminders due", "processed": 0}
```

---

## Database Schema

### Tasks Table Additions

```sql
ALTER TABLE tasks ADD COLUMN reminder_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN reminder_sent BOOLEAN DEFAULT false;
```

| Column | Type | Description |
|--------|------|-------------|
| `reminder_at` | `TIMESTAMPTZ` | When to send the notification (ISO timestamp) |
| `reminder_sent` | `BOOLEAN` | Whether notification has been sent (prevents duplicates) |

### Index for Performance

```sql
CREATE INDEX idx_tasks_pending_reminders 
  ON tasks(reminder_at) 
  WHERE reminder_at IS NOT NULL AND reminder_sent = false;
```

This partial index ensures efficient queries for pending reminders.

---

## Edge Function

### Location

`supabase/functions/send-reminders/index.ts`

### Logic Flow

1. Query tasks where:
   - `reminder_at` is within the last 2 minutes (catches any missed)
   - `reminder_at` is not in the future
   - `reminder_sent` is false
   - `is_completed` is false

2. For each task:
   - Call OneSignal REST API with `include_external_user_ids: [user_id]`
   - Mark `reminder_sent = true`

3. Return summary of processed reminders

### Environment Variables Required

| Variable | Description |
|----------|-------------|
| `ONESIGNAL_APP_ID` | Your OneSignal App ID |
| `ONESIGNAL_REST_API_KEY` | Your OneSignal REST API Key |
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase |

---

## Frontend Components

### usePushNotifications.ts

```typescript
// Key exports
export function usePushNotifications() {
  return {
    isSupported,      // Whether browser supports push
    isSubscribed,     // Whether user has granted permission
    isLoading,        // Loading state
    permissionState,  // 'default' | 'granted' | 'denied'
    showIOSPrompt,    // Whether to show iOS install prompt
    needsPWAInstall,  // iOS Safari detection
    oneSignalUserId,  // For external user ID
    subscribe,        // Request permission
    setExternalUserId,// Link to Supabase user
    addTags,          // Add user segments
    dismissIOSPrompt  // Close iOS prompt
  };
}
```

### Reminder UI in Modals

Both `AddTaskModal.vue` and `EditTaskModal.vue` include:

- Toggle switch to enable/disable reminder
- Date picker (defaults to due date or today)
- Time picker (defaults to 9:00 AM)
- iOS PWA prompt when needed
- Helper text confirming notification

### TaskCard Reminder Badge

Purple badge showing formatted reminder time:
- "Today 2:30 PM"
- "Tomorrow 9:00 AM"
- "Jan 15 10:00 AM"

Only shown when `reminder_at` exists and `reminder_sent` is false.

---

## Future Enhancements

### Potential Improvements

| Enhancement | Effort | Value |
|-------------|--------|-------|
| **Recurring reminders** | Medium | Daily/weekly task reminders |
| **Snooze from notification** | Medium | "Remind me in 1 hour" action |
| **Smart reminders** | High | Based on location/time patterns |
| **Email fallback** | Medium | For users who can't use push |
| **Reminder history** | Low | See past notifications |

### When to Revisit

| Signal | Action |
|--------|--------|
| >30% of tasks have reminders | Consider recurring reminders |
| User complaints about missed | Add email fallback |
| iOS users confused | Improve PWA onboarding flow |
| High notification volume | Add batching/digest option |

---

## Testing Checklist

- [ ] Create task with reminder → Verify saved to DB
- [ ] Edit task reminder → Verify updates correctly
- [ ] Reminder badge displays on TaskCard
- [ ] Desktop Chrome notification works
- [ ] Desktop Safari notification works
- [ ] Android Chrome notification works
- [ ] iOS PWA notification works (after install)
- [ ] iOS Safari shows install prompt
- [ ] Edge Function processes due reminders
- [ ] Completed tasks don't trigger reminders
- [ ] Past reminders marked as sent

---

# Feature Roadmap: Natural Language Input (NLI)

> **Date**: January 2026
> **Status**: ✅ Implemented (v1.1.0)
> **Commitment Level**: Bet

---

## Executive Summary

Natural Language Input allows users to create tasks using conversational text. The parser extracts dates, times, categories, and reminders automatically from the input, supporting both English and Malay (Bahasa Malaysia) including SMS shortforms.

---

## What Was Built

| Component | Description |
|-----------|-------------|
| **parseTaskInput.ts** | Core parser with chrono-node + custom Malay parser |
| **Malay Date Parser** | Full Bahasa Malaysia support with SMS shortforms |
| **AddTaskModal.vue** | Live preview + auto-fill for parsed values |
| **App.vue Quick Add** | NLI support in header quick-add input |
| **Reminder Detection** | Multiple patterns: `!remind`, `ingatkan`, etc. |

---

## Supported Syntax

### English (via chrono-node)

| Pattern | Examples |
|---------|----------|
| Relative dates | `tomorrow`, `next friday`, `in 3 days` |
| Specific dates | `jan 15`, `march 3rd`, `2026-01-15` |
| Times | `3pm`, `9:30am`, `at noon` |
| Combined | `next monday at 2pm` |

### Malay (Custom Parser)

| Type | Full Form | SMS Shortform |
|------|-----------|---------------|
| Tomorrow | `esok` | `esk`, `bsk` |
| Day after | `lusa` | `lsa` |
| Yesterday | `semalam` | `smlm` |
| Today | `hari ini` | `hr ni`, `hrni` |
| Next week | `minggu depan` | `mggu dpn` |
| Next month | `bulan depan` | `bln dpn` |
| Days | `isnin`, `selasa`... | `isn`, `sls`... |
| Morning | `pagi` | `pg`, `pgi` |
| Afternoon | `petang` | `ptg` |
| Night | `malam` | `mlm` |
| Time | `pukul 3` | `pkl 3`, `jm 3` |

### Categories & Reminders

| Type | Patterns |
|------|----------|
| Category | `#work`, `#personal`, `#family` |
| Reminder (prefix) | `!reminder`, `!remind`, `!ingat`, `@remind` |
| Reminder (natural) | `remind me`, `ingatkan`, `ingatkan saya` |

---

## Technical Architecture

```
User Input: "Beli susu esk pgi #personal ingatkan"
                          │
                          ▼
              ┌───────────────────────┐
              │   parseTaskInput()    │
              │  ├─ Extract #category │
              │  ├─ Extract reminder  │
              │  ├─ Try Malay parser  │
              │  └─ Fallback: chrono  │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  ParsedTask Result    │
              │  ├─ title: "Beli susu"│
              │  ├─ dueDate: tomorrow │
              │  ├─ category: personal│
              │  └─ hasReminder: true │
              └───────────────────────┘
```

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `chrono-node` | ^2.9.0 | English date parsing |

### Files

| File | Purpose |
|------|---------|
| `src/lib/parseTaskInput.ts` | Core parser (~400 lines) |
| `src/components/AddTaskModal.vue` | UI integration |
| `src/App.vue` | Quick-add integration |

---

## UX Design

### AddTaskModal Preview

```
┌─────────────────────────────────────────────────┐
│  Task title                                     │
│  ┌───────────────────────────────────────────┐  │
│  │ Meeting isnin dpn ptg #work remind me     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌─ Detected ─────────────────────────────────┐ │
│  │ 📝 Meeting                                 │ │
│  │ 📅 Mon, Jan 6, 3:00 PM                     │ │
│  │ 🏷️ Work                                    │ │
│  │ 🔔 Reminder                                │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Quick Add Preview

```
┌──────────────────────────────────────────────────┐
│ 📝 Buy groceries esk pgi #personal               │
├──────────────────────────────────────────────────┤
│ Detected: 📅 Tomorrow, 8:00 AM  🏷️ Personal     │
└──────────────────────────────────────────────────┘
```

---

## Future Enhancements

| Enhancement | Effort | Value |
|-------------|--------|-------|
| **Recurring patterns** | Medium | "every monday", "setiap isnin" |
| **Priority detection** | Low | "!high", "!urgent", "penting" |
| **Location parsing** | Medium | "@office", "di pejabat" |
| **Duration estimation** | Medium | "30 min", "2 hours" |
| **Indonesian support** | Low | Similar to Malay with spelling variants |

---

# Feature Roadmap: What's New Dialog

> **Date**: January 2026
> **Status**: ✅ Implemented (v1.1.0)
> **Commitment Level**: Standard

---

## Executive Summary

A friendly changelog dialog that shows users new features after app updates. Dismissal state is persisted to Supabase user metadata to prevent repeated prompts.

---

## What Was Built

| Component | Description |
|-----------|-------------|
| **changelog.ts** | Version entries with features list |
| **WhatsNewModal.vue** | Animated modal with feature cards |
| **useAuth.ts** | Extended to track `lastSeenChangelog` |
| **Supabase metadata** | Stores dismissed version persistently |

---

## Technical Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Login    │────▶│  Check Version  │────▶│  Show Modal?    │
│                 │     │  lastSeenChange │     │  compare vers.  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                              ┌──────────────────────────┤
                              ▼                          ▼
                    ┌─────────────────┐        ┌─────────────────┐
                    │  No new version │        │  Show WhatsNew  │
                    │  (do nothing)   │        │  Modal          │
                    └─────────────────┘        └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  On Dismiss:    │
                                               │  Save to DB +   │
                                               │  localStorage   │
                                               └─────────────────┘
```

### Storage Strategy

| Storage | Purpose |
|---------|---------|
| **Supabase user_metadata** | Primary - persists across devices |
| **localStorage** | Fallback - works offline |

---

## Changelog Data Structure

```typescript
// src/lib/changelog.ts
interface ChangelogEntry {
  version: string      // Semantic version "1.1.0"
  date: string         // ISO date "2026-01-03"
  title: string        // Friendly name "Smart Task Input"
  features: {
    icon: string       // Material symbol name
    title: string      // Feature name
    description: string // Brief explanation
  }[]
}
```

### Adding New Changelog Entries

```typescript
// Add at TOP of CHANGELOG array (newest first)
{
  version: '1.2.0',
  date: '2026-01-15',
  title: 'Recurring Tasks',
  features: [
    {
      icon: 'repeat',
      title: 'Recurring Tasks',
      description: 'Set tasks to repeat daily, weekly, or monthly.'
    }
  ]
}
```

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/changelog.ts` | Changelog data & version helpers |
| `src/components/WhatsNewModal.vue` | Modal component |
| `src/composables/useAuth.ts` | Extended with lastSeenChangelog |
| `src/App.vue` | Modal integration |

---

## UX Design

```
┌────────────────────────────────────────┐
│  ✨ What's New                         │
│  ┌──────────────────────────────────┐  │
│  │  Smart Task Input        v1.1.0 │  │
│  └──────────────────────────────────┘  │
│                                        │
│  🪄 Natural Language Input             │
│     Type tasks naturally!              │
│                                        │
│  🌐 Malay Language Support             │
│     Full Bahasa Malaysia + SMS slang   │
│                                        │
│  🔔 Smart Reminders                    │
│     Just type "remind me"              │
│                                        │
│            [Skip]  [Got it!]           │
└────────────────────────────────────────┘
```

### Features

- **Gradient header** with version info
- **Feature cards** with icons
- **Pagination dots** for multiple entries
- **Skip button** for immediate dismiss
- **Smooth animations** for open/close

---

## Future Enhancements

| Enhancement | Effort | Value |
|-------------|--------|-------|
| **Feature highlights** | Low | Animate specific UI elements |
| **Interactive tour** | Medium | Step-by-step feature walkthrough |
| **Release notes link** | Low | Link to full changelog page |
| **Image/GIF support** | Low | Visual demos in features |

---

# Feature Summary: Current App Capabilities

> **Date**: January 2026
> **Version**: v1.1.0+

---

## Complete Feature List

This section provides a comprehensive overview of all features currently implemented in EZTodo.

### Core Task Management

| Feature | Description |
|---------|-------------|
| **Task CRUD** | Create, read, update, delete tasks with full validation |
| **Subtasks** | Break tasks into smaller steps with progress tracking (e.g., "2/5 completed") |
| **Due Dates** | Date picker with visual badges: Overdue (red), Today (amber), future dates |
| **Categories** | Custom categories with color picker, filtering, and default starter categories |

### Smart Input (Natural Language Processing)

| Feature | Description |
|---------|-------------|
| **English NLI** | "tomorrow 3pm", "next friday", "in 3 days", "jan 15" via chrono-node |
| **Malay NLI** | "esok pagi", "isnin depan", "lusa petang" with full Bahasa Malaysia support |
| **SMS Shortforms** | "esk", "smlm", "mggu dpn", "ptg", "pkl 3" for quick input |
| **Category Detection** | `#work`, `#personal` extracted from input |
| **Reminder Detection** | "remind me", "!reminder", "ingatkan" triggers reminder |
| **Live Preview** | Real-time display of parsed date, category, reminder as user types |
| **Voice Input** | Microphone button with Web Speech API (speech-to-text) |

### Push Notifications & Reminders

| Feature | Description |
|---------|-------------|
| **OneSignal Integration** | Cross-platform push notifications |
| **Task Reminders** | Date/time picker with purple reminder badge on cards |
| **iOS PWA Support** | Detection + installation prompt for iOS users |
| **Edge Function** | `send-reminders` processes due reminders every minute via pg_cron |

### Task Sharing & Collaboration

| Feature | Description |
|---------|-------------|
| **Email Invites** | Share with specific users by email address |
| **Share Links** | Generate reusable URLs with configurable expiration (1/7/30 days or never) |
| **WhatsApp Share** | Quick share button with pre-filled message |
| **Recipient Management** | View active shares, status tracking, revoke access |
| **Shared Task Reception** | Accept via `/share/{token}` route, preview before accepting |
| **Completion Notifications** | Owner notified when shared user completes task |
| **Real-time Updates** | Broadcast channel pushes changes to all recipients |

### Synchronization & Offline

| Feature | Description |
|---------|-------------|
| **Real-time Sync** | Supabase Realtime for instant cross-device updates |
| **Sync Status Indicator** | Visual component showing synced/syncing/offline/error states |
| **Offline Queue** | LocalStorage queue for offline operations, auto-syncs on reconnect |
| **Task Caching** | LocalStorage cache for offline viewing and graceful degradation |

### Authentication & User Management

| Feature | Description |
|---------|-------------|
| **Google OAuth** | Single sign-on with persistent sessions |
| **User Profile** | Name, avatar, theme preference stored in Supabase |
| **Changelog Tracking** | `lastSeenChangelog` stored in user metadata for What's New modal |

### User Interface & Themes

| Feature | Description |
|---------|-------------|
| **7 Theme Presets** | Light, Dark, Dim, Sepia, Vibrant Purple, Blush, Playful Kids |
| **Mobile Responsive** | Bottom-sheet modals on mobile, centered on desktop |
| **PWA Support** | Install prompts, standalone mode, service worker detection |
| **Accessibility** | ARIA labels, focus management, keyboard navigation |

### UI Components

| Component | Purpose |
|-----------|---------|
| **AddTaskModal** | Full task creation with NLI preview, voice input, reminder picker |
| **EditTaskModal** | Modify existing tasks (read-only for shared tasks) |
| **ShareTaskModal** | Email/link sharing with recipient management |
| **CategoryManagerModal** | Create, edit, delete, and color-pick categories |
| **WhatsNewModal** | Version-based changelog with animated feature cards |
| **IOSInstallPrompt** | Bottom sheet guiding iOS PWA installation |
| **Toast Notifications** | Success/error/info feedback system |

### Visual Indicators

| Indicator | Description |
|-----------|-------------|
| **Completion Animation** | Animated checkmark with bounce effect |
| **Due Date Badges** | Color-coded: Overdue (red), Today (amber), Future (styled) |
| **Reminder Badge** | Purple badge with formatted time: "Today 9:00 AM" |
| **Shared Task Badge** | Blue badge with owner avatar: "Shared by [Name]" |
| **Category Dots** | Color dots matching category in dropdowns |

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vue 3 + TypeScript + Vite |
| **Styling** | Tailwind CSS |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| **Push Notifications** | OneSignal |
| **Date Parsing** | chrono-node + custom Malay parser |
| **Deployment** | Cloudflare Pages |

---

## File Structure Overview

```
src/
├── components/
│   ├── AddTaskModal.vue
│   ├── EditTaskModal.vue
│   ├── ShareTaskModal.vue
│   ├── CategoryManagerModal.vue
│   ├── WhatsNewModal.vue
│   ├── IOSInstallPrompt.vue
│   ├── TaskCard.vue
│   ├── LandingPage.vue
│   └── ...
├── composables/
│   ├── useTasks.ts          # Core task CRUD + real-time sync
│   ├── useTaskSharing.ts    # Share functionality
│   ├── useAuth.ts           # Authentication + user metadata
│   ├── useCategories.ts     # Category management
│   └── usePushNotifications.ts  # OneSignal integration
├── lib/
│   ├── parseTaskInput.ts    # NLI parser (English + Malay)
│   └── changelog.ts         # Version changelog data
├── types.ts                 # TypeScript interfaces
└── App.vue                  # Main app shell

supabase/
├── functions/
│   ├── send-reminders/      # Push notification sender
│   └── notify-task-completion/  # Shared task completion alerts
└── migrations/
    └── *.sql                # Database schema
```

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **v1.0.0** | Dec 2025 | Initial release: Tasks, categories, offline sync |
| **v1.0.1** | Jan 2026 | Task sharing (email + link), completion notifications |
| **v1.0.2** | Jan 2026 | Push reminders (OneSignal), iOS PWA support |
| **v1.1.0** | Jan 2026 | Natural Language Input, Malay support, What's New modal |

---

*Document maintained by: Development Team*
*Last updated: January 2026*
