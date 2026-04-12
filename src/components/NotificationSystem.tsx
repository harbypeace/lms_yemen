import React, { useState, useEffect } from 'react';
import { supabase, Notification } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, X, Info, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const NotificationSystem: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !activeTenant) return;

    fetchNotifications();

    // Subscribe to real-time notifications
    const subscription = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // Optional: Show a toast here
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
          if (updatedNotification.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, activeTenant]);

  const fetchNotifications = async () => {
    if (!user || !activeTenant) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter((n) => !n.read).length || 0);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user || !activeTenant) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('tenant_id', activeTenant.id)
      .eq('read', false);

    if (error) {
      console.error('Error marking all as read:', error);
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3",
                          !notification.read ? "bg-indigo-50/30" : ""
                        )}
                        onClick={() => {
                          if (!notification.read) markAsRead(notification.id);
                          if (notification.link) {
                            window.location.href = notification.link;
                          }
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm font-medium text-slate-900",
                              !notification.read && "font-bold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {new Date(notification.created_at).toLocaleDateString()} at {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
