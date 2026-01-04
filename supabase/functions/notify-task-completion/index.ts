// Supabase Edge Function: notify-task-completion
// This function sends a push notification to task owners when a shared user completes their task
// Called from the client when a shared user marks a task as complete

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || 'https://eztodo.pages.dev';

interface NotifyRequest {
  task_id: string;
  task_title: string;
  completed_by_name: string;
  completed_by_user_id: string;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Create a Supabase client with the user's JWT to verify authentication
    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const { task_id, task_title, completed_by_name, completed_by_user_id }: NotifyRequest = await req.json();

    if (!task_id || !task_title || !completed_by_name || !completed_by_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: task_id, task_title, completed_by_name, completed_by_user_id' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get task owner ID
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('user_id')
      .eq('id', task_id)
      .single();

    if (taskError || !task) {
      console.error('Error fetching task:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if per-task notification is enabled for this share
    // Find the share record for this task and user
    const { data: share, error: shareError } = await supabase
      .from('task_shares')
      .select('notify_on_complete')
      .eq('task_id', task_id)
      .eq('owner_id', task.user_id)
      .eq('shared_with_id', completed_by_user_id)
      .neq('status', 'revoked')
      .single();

    if (shareError) {
      console.error('Error fetching share:', shareError);
      // Continue anyway - default to sending notification
    }

    // Check if notifications are disabled for this specific task share
    if (share && share.notify_on_complete === false) {
      return new Response(
        JSON.stringify({ message: 'Notifications disabled for this task share', sent: false }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Send push notification to task owner
    const sent = await sendOneSignalNotification(
      task.user_id,
      'Task Completed!',
      `${completed_by_name} completed "${task_title}"`,
      task_id
    );

    return new Response(
      JSON.stringify({
        message: sent ? 'Notification sent' : 'Failed to send notification',
        sent
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
