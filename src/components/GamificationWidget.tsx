import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Trophy, Star, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface UserGamification {
  total_xp: number;
  level: number;
  streak_days: number;
}

interface Badge {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  earned_at: string;
}

export const GamificationWidget: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserGamification | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch Stats - Using maybeSingle instead of single to avoid 406/PGRST116 issues
        const { data: statsData, error: statsError } = await supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (statsError) {
          console.error('Error fetching gamification stats:', statsError);
        } else if (statsData) {
          setStats(statsData);
        }

        // Fetch Badges
        const { data: badgesData, error: badgesError } = await supabase
          .from('user_badges')
          .select(`
            earned_at,
            badges (*)
          `)
          .eq('user_id', user.id);

        if (badgesError) {
          console.error('Error fetching badges:', badgesError);
        } else if (badgesData) {
          setBadges(badgesData.map((b: any) => ({
            ...b.badges,
            earned_at: b.earned_at
          })));
        }
      } catch (err) {
        console.error('Unexpected error fetching gamification data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime updates with a unique channel name to prevent Strict Mode conflicts
    const channelId = `gamification_widget_${user.id}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_gamification',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            setStats(payload.new as UserGamification);
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
        async () => {
          // Re-fetch badges on new badge earned
          const { data } = await supabase
            .from('user_badges')
            .select(`earned_at, badges (*)`)
            .eq('user_id', user.id);
          
          if (data) {
            setBadges(data.map((b: any) => ({
              ...b.badges,
              earned_at: b.earned_at
            })));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (loading) {
    return <div className="animate-pulse h-24 bg-slate-100 rounded-2xl"></div>;
  }

  const currentXp = stats?.total_xp || 0;
  const currentLevel = stats?.level || 1;
  const currentStreak = stats?.streak_days || 0;

  const xpForCurrentLevel = Math.pow(currentLevel - 1, 2) * 100;
  const xpForNextLevel = Math.pow(currentLevel, 2) * 100;
  const progressToNextLevel = ((currentXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
            <Trophy className="w-8 h-8 relative z-10 group-hover:scale-110 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Level {currentLevel}</p>
              <div className="w-1 h-1 bg-slate-300 rounded-full" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentXp} Total XP</p>
            </div>
            <p className="text-2xl font-black text-slate-900 leading-tight">Master Learner</p>
          </div>
        </div>

        <div className="flex-1 w-full max-w-md">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
            <span>Next Level</span>
            <span>{currentXp} / {xpForNextLevel} XP</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progressToNextLevel))}%` }}
              className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.4)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-3 bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100 shadow-sm shadow-orange-50">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none mb-1">Streak</p>
              <p className="text-lg font-black text-orange-700 leading-none">{currentStreak} Days</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm shadow-indigo-50">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
              <Star className="w-5 h-5 fill-current" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Badges</p>
              <p className="text-lg font-black text-indigo-700 leading-none">{badges.length}</p>
            </div>
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {badges.map((badge) => (
            <div 
              key={badge.id}
              className="group relative flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm hover:border-indigo-300 transition-all cursor-help"
              title={badge.description}
            >
              <span className="text-xl">{badge.icon}</span>
              <span className="text-sm font-bold text-slate-700">{badge.title}</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                <p className="font-bold mb-1">{badge.title}</p>
                <p className="text-slate-400">{badge.description}</p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
