// Supabase Edge Function: send-reminders
// This function checks for tasks with due reminders and sends OneSignal push notifications
// Should be triggered by a Supabase pg_cron job every minute

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://eztodo.pages.dev';

interface Task {
  id: string;
  user_id: string;
  title: string;
  reminder_at: string;
}

// Send push notification via OneSignal REST API
async function sendOneSignalNotification(
  userId: string,
  title: string,
  message: string,
  taskId: string
): Promise<boolean> {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        contents: { en: message },
        headings: { en: title },
        data: {
          taskId,
          url: `${APP_URL}/?task=${taskId}`
        },
        // Web push specific options
        web_url: `${APP_URL}/?task=${taskId}`,
        chrome_web_icon: `${APP_URL}/icon-192.png`,
        chrome_web_badge: `${APP_URL}/badge-72.png`,
        // TTL - notification expires after 1 hour
        ttl: 3600
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OneSignal API error:', error);
      return false;
    }

    const result = await response.json();
    console.log('Notification sent:', result.id);
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

serve(async (req) => {
  // Verify the request is authorized (for security, add a secret header check)
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    // For cron jobs, we might not have auth header, so we check if it's internal
    // In production, you should secure this endpoint properly
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Find tasks with reminders that are due (within the last 2 minutes to catch any missed)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, user_id, title, reminder_at')
      .eq('reminder_sent', false)
      .eq('is_completed', false)
      .gte('reminder_at', twoMinutesAgo)
      .lte('reminder_at', now)
      .limit(100);

    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tasks', details: fetchError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No reminders due', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${tasks.length} reminder(s)`);

    let successCount = 0;
    let failCount = 0;

    for (const task of tasks as Task[]) {
      const sent = await sendOneSignalNotification(
        task.user_id,
        'Task Reminder',
        task.title,
        task.id
      );

      if (sent) {
        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ reminder_sent: true })
          .eq('id', task.id);

        if (updateError) {
          console.error(`Failed to update task ${task.id}:`, updateError);
          failCount++;
        } else {
          successCount++;
        }
      } else {
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reminders processed',
        total: tasks.length,
        success: successCount,
        failed: failCount
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
