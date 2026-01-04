import { ref, computed } from 'vue';
import { supabase } from '../services/supabase';
import type { TaskShare, TaskShareWithUser, ShareLinkResponse } from '../types';

export function useTaskSharing() {
  const shares = ref<TaskShareWithUser[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch all shares for a task (owner only)
  const fetchShares = async (taskId: string) => {
    if (!taskId) return;

    loading.value = true;
    error.value = null;

    try {
      // Fetch shares first
      const { data, error: fetchError } = await supabase
        .from('task_shares')
        .select('*')
        .eq('task_id', taskId)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch profile info for users who have accepted
      const userIds = (data || [])
        .filter(s => s.shared_with_id)
        .map(s => s.shared_with_id);

      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      }

      // Map the data to include user info where available
      // Filter out link-only shares (share_token but no shared_with_id and no shared_with_email)
      // These are just reusable link templates, not actual shares with people
      shares.value = (data || [])
        .filter(share => {
          // Keep if it has a shared_with_id (accepted by someone)
          if (share.shared_with_id) return true;
          // Keep if it has a shared_with_email (email invite)
          if (share.shared_with_email) return true;
          // Filter out link-only templates (share_token but no user/email)
          return false;
        })
        .map(share => {
          const profile = share.shared_with_id ? profilesMap[share.shared_with_id] : null;
          return {
            ...share,
            shared_user: share.shared_with_id ? {
              id: share.shared_with_id,
              email: profile?.email || share.shared_with_email || '',
              name: profile?.name || share.shared_with_email?.split('@')[0] || '',
              avatar: profile?.avatar_url || ''
            } : undefined
          };
        });
    } catch (e) {
      error.value = 'Failed to load shares';
      console.error(e);
    } finally {
      loading.value = false;
    }
  };

  // Create email invite
  const shareByEmail = async (taskId: string, email: string, notifyOnComplete: boolean = true): Promise<TaskShare | null> => {
    if (!taskId || !email) return null;

    loading.value = true;
    error.value = null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error: createError } = await supabase
        .from('task_shares')
        .insert({
          task_id: taskId,
          owner_id: userData.user.id,
          shared_with_email: email.toLowerCase().trim(),
          permission: 'edit',
          status: 'pending',
          notify_on_complete: notifyOnComplete
        })
        .select()
        .single();

      if (createError) throw createError;

      await fetchShares(taskId);
      return data;
    } catch (e: any) {
      if (e.code === '23505') {
        error.value = 'This task is already shared with this email';
      } else {
        error.value = 'Failed to share task';
      }
      console.error(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Generate shareable link (or return existing one)
  const generateShareLink = async (taskId: string, expiresInDays?: number, notifyOnComplete: boolean = true): Promise<ShareLinkResponse | null> => {
    if (!taskId) return null;

    loading.value = true;
    error.value = null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Check if there's already an active share link for this task
      const { data: existingShare } = await supabase
        .from('task_shares')
        .select('*')
        .eq('task_id', taskId)
        .eq('owner_id', userData.user.id)
        .not('share_token', 'is', null)
        .neq('status', 'revoked')
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();

      if (existingShare) {
        // Return existing link
        const shareUrl = `${window.location.origin}/share/${existingShare.share_token}`;
        return {
          share_id: existingShare.id,
          share_token: existingShare.share_token,
          share_url: shareUrl,
          expires_at: existingShare.expires_at
        };
      }

      // Generate new token via database function
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_share_token');
      if (tokenError) throw tokenError;
      const token = tokenData as string;

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error: createError } = await supabase
        .from('task_shares')
        .insert({
          task_id: taskId,
          owner_id: userData.user.id,
          share_token: token,
          permission: 'edit',
          status: 'pending',
          expires_at: expiresAt,
          notify_on_complete: notifyOnComplete
        })
        .select()
        .single();

      if (createError) throw createError;

      const shareUrl = `${window.location.origin}/share/${token}`;

      await fetchShares(taskId);

      return {
        share_id: data.id,
        share_token: token,
        share_url: shareUrl,
        expires_at: expiresAt
      };
    } catch (e) {
      error.value = 'Failed to generate share link';
      console.error(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Revoke a share
  const revokeShare = async (shareId: string, _taskId?: string): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const { error: updateError } = await supabase
        .from('task_shares')
        .update({ status: 'revoked' })
        .eq('id', shareId);

      if (updateError) throw updateError;

      shares.value = shares.value.filter(s => s.id !== shareId);
      return true;
    } catch (e) {
      error.value = 'Failed to revoke share';
      console.error(e);
      return false;
    } finally {
      loading.value = false;
    }
  };

  // Get task preview by share token (without accepting)
  const getSharePreview = async (token: string): Promise<{ task: any; owner: any } | null> => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: previewError } = await supabase
        .rpc('get_share_preview', { p_token: token });

      if (previewError) throw previewError;
      return data;
    } catch (e: any) {
      error.value = e.message || 'Invalid or expired share link';
      console.error(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Accept a share (for recipient via token)
  const acceptShareByToken = async (token: string): Promise<TaskShare | null> => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: acceptError } = await supabase
        .rpc('accept_share_by_token', { p_token: token });

      if (acceptError) throw acceptError;
      return data;
    } catch (e: any) {
      error.value = e.message || 'Failed to accept share';
      console.error(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Check for pending shares on login
  const claimPendingShares = async (): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('claim_pending_shares');
      if (error) throw error;
      return data || 0;
    } catch (e) {
      console.error('Failed to claim pending shares:', e);
      return 0;
    }
  };

  const activeShareCount = computed(() =>
    shares.value.filter(s => s.status === 'accepted').length
  );

  const pendingShareCount = computed(() =>
    shares.value.filter(s => s.status === 'pending').length
  );

  // Clear shares when changing tasks
  const clearShares = () => {
    shares.value = [];
    error.value = null;
  };

  return {
    shares,
    loading,
    error,
    activeShareCount,
    pendingShareCount,
    fetchShares,
    shareByEmail,
    generateShareLink,
    revokeShare,
    getSharePreview,
    acceptShareByToken,
    claimPendingShares,
    clearShares
  };
}
