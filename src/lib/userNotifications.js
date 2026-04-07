import { supabase } from '../services/supabase';

/**
 * @typedef {Object} UserNotificationRow
 * @property {string} id
 * @property {string} user_id
 * @property {string} type
 * @property {string} title
 * @property {string} message
 * @property {Record<string, unknown>} [data]
 * @property {boolean} read
 * @property {string} created_at
 */

/**
 * @param {string} userId
 * @returns {Promise<UserNotificationRow[]>}
 */
export async function fetchUserNotifications(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.warn('[userNotifications] fetch:', error.message);
        return [];
    }
    return data || [];
}

/**
 * @param {string} userId
 * @param {(n: UserNotificationRow) => void} onInsert
 * @returns {() => void}
 */
export function setupUserNotificationSubscription(userId, onInsert) {
    if (!userId) {
        return () => {};
    }

    const channel = supabase
        .channel(`user-notifications-${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'user_notifications',
                filter: `user_id=eq.${encodeURIComponent(String(userId))}`,
            },
            (payload) => {
                const row = payload.new;
                if (row && typeof onInsert === 'function') {
                    onInsert(row);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
                console.warn('[userNotifications] realtime channel error');
            }
        });

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * @param {string} notificationId
 */
export async function markUserNotificationRead(notificationId) {
    const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('id', notificationId);

    if (error) {
        console.warn('[userNotifications] mark read:', error.message);
        return false;
    }
    return true;
}

/**
 * @param {string} userId
 */
export async function markAllUserNotificationsRead(userId) {
    if (!userId) return false;

    const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

    if (error) {
        console.warn('[userNotifications] mark all read:', error.message);
        return false;
    }
    return true;
}
