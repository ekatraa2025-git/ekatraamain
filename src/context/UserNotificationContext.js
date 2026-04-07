import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    fetchUserNotifications,
    setupUserNotificationSubscription,
    markUserNotificationRead,
    markAllUserNotificationsRead,
} from '../lib/userNotifications';

const UserNotificationContext = createContext({
    notifications: [],
    unreadCount: 0,
    loading: true,
    refreshNotifications: async () => {},
    markAsRead: async () => {},
    markAllAsRead: async () => {},
});

export function UserNotificationProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadNotifications = useCallback(async () => {
        if (!userId) {
            setNotifications([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const rows = await fetchUserNotifications(userId);
            setNotifications(rows);
        } catch (e) {
            console.warn('[UserNotificationContext] load', e);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    useEffect(() => {
        if (!userId) return undefined;

        const unsubscribe = setupUserNotificationSubscription(userId, (row) => {
            setNotifications((prev) => [row, ...prev.filter((p) => p.id !== row.id)]);
        });

        return unsubscribe;
    }, [userId]);

    const markAsRead = useCallback(
        async (id) => {
            await markUserNotificationRead(id);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        },
        []
    );

    const markAllAsRead = useCallback(async () => {
        if (!userId) return;
        await markAllUserNotificationsRead(userId);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, [userId]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const value = useMemo(
        () => ({
            notifications,
            unreadCount,
            loading,
            refreshNotifications: loadNotifications,
            markAsRead,
            markAllAsRead,
        }),
        [notifications, unreadCount, loading, loadNotifications, markAsRead, markAllAsRead]
    );

    return <UserNotificationContext.Provider value={value}>{children}</UserNotificationContext.Provider>;
}

export function useUserNotifications() {
    return useContext(UserNotificationContext);
}
