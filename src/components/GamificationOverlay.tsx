import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Zap, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export const GamificationOverlay: React.FC = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState<{ type: 'level_up' | 'badge_earned', data: any } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Use a unique channel name to prevent conflicts during React Strict Mode's double-invocation
    const channelId = `gamification_updates_${user.id}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_stats',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldLevel = payload.old?.level;
          const newLevel = payload.new?.level;
          
          if (oldLevel && newLevel && newLevel > oldLevel) {
            setNotification({ type: 'level_up', data: { level: newLevel } });
            triggerConfetti();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('badges')
            .select('*')
            .eq('id', payload.new.badge_id)
            .maybeSingle();
          
          if (data) {
            setNotification({ type: 'badge_earned', data });
            triggerConfetti();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#4f46e5', '#818cf8', '#fbbf24', '#f59e0b']
    });
  };

  return (
    <AnimatePresence>
      {notification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative"
          >
            <button 
              onClick={() => setNotification(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200 animate-bounce">
                {notification.type === 'level_up' ? (
                  <Zap className="w-10 h-10 fill-current" />
                ) : (
                  <Trophy className="w-10 h-10" />
                )}
              </div>

              <h2 className="text-3xl font-black text-slate-900 mb-2">
                {notification.type === 'level_up' ? 'Level Up!' : 'New Badge!'}
              </h2>
              
              <p className="text-slate-500 font-medium mb-6">
                {notification.type === 'level_up' 
                  ? `Congratulations! You've reached Level ${notification.data.level}`
                  : `You've earned the "${notification.data.title}" badge!`}
              </p>

              {notification.type === 'badge_earned' && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                  <span className="text-4xl block mb-2">{notification.data.icon}</span>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{notification.data.description}</p>
                </div>
              )}

              <button
                onClick={() => setNotification(null)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Awesome!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
