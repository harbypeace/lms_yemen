import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Award, Loader2, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  level: number;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

export const GlobalLeaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('user_gamification')
          .select(`
            user_id,
            total_xp,
            level,
            profiles (
              full_name,
              avatar_url
            )
          `)
          .order('total_xp', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching global leaderboard:', error);
        } else if (data) {
          // @ts-ignore
          setLeaderboard(data as LeaderboardEntry[]);
        }
      } catch (err) {
        console.error('Unexpected error fetching global leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();

    // Subscribe to changes
    const channel = supabase
      .channel('global-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_gamification' },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Loading top learners...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Global Leaderboard</h3>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Top 10 Learners</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Users className="w-4 h-4" />
          <span className="text-sm font-bold">{leaderboard.length} Active</span>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100">
        {leaderboard.map((entry, index) => (
          <motion.div 
            key={entry.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center justify-between p-4 transition-all hover:bg-slate-50 ${
              index === 0 ? 'bg-yellow-50/30' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 flex justify-center">
                {index === 0 ? <Trophy className="w-6 h-6 text-yellow-500" /> :
                 index === 1 ? <Medal className="w-6 h-6 text-slate-400" /> :
                 index === 2 ? <Award className="w-6 h-6 text-orange-400" /> :
                 <span className="font-black text-slate-300 text-lg">#{index + 1}</span>}
              </div>
              
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden border-2 border-white shadow-sm">
                  {entry.profiles?.avatar_url ? (
                    <img src={entry.profiles.avatar_url} alt={entry.profiles.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">{entry.profiles?.full_name?.[0] || '?'}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                  {entry.level}
                </div>
              </div>
              
              <div>
                <p className="font-bold text-slate-900">{entry.profiles?.full_name || 'Anonymous Learner'}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Level {entry.level}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-lg font-black text-indigo-600">{entry.total_xp.toLocaleString()}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total XP</div>
            </div>
          </motion.div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-slate-400 font-medium">No data available yet.</p>
        </div>
      )}
    </div>
  );
};
