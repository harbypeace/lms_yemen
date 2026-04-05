import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  xp: number;
  level: number;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CourseLeaderboardProps {
  courseId: string;
}

export const CourseLeaderboard: React.FC<CourseLeaderboardProps> = ({ courseId }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('user_course_gamification')
          .select(`
            user_id,
            xp,
            level,
            profiles (
              full_name,
              avatar_url
            )
          `)
          .eq('course_id', courseId)
          .order('xp', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching leaderboard:', error);
        } else if (data) {
          // @ts-ignore - Supabase types can be tricky with joins
          setLeaderboard(data as LeaderboardEntry[]);
        }
      } catch (err) {
        console.error('Unexpected error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [courseId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Course Leaderboard
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        Course Leaderboard
      </h3>
      
      <div className="space-y-3">
        {leaderboard.map((entry, index) => (
          <div 
            key={entry.user_id}
            className={`flex items-center justify-between p-3 rounded-xl border ${
              index === 0 ? 'bg-yellow-50 border-yellow-100' :
              index === 1 ? 'bg-slate-50 border-slate-200' :
              index === 2 ? 'bg-orange-50 border-orange-100' :
              'bg-white border-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 flex justify-center">
                {index === 0 ? <Trophy className="w-5 h-5 text-yellow-500" /> :
                 index === 1 ? <Medal className="w-5 h-5 text-slate-400" /> :
                 index === 2 ? <Award className="w-5 h-5 text-orange-400" /> :
                 <span className="font-bold text-slate-400">#{index + 1}</span>}
              </div>
              
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                {entry.profiles?.avatar_url ? (
                  <img src={entry.profiles.avatar_url} alt={entry.profiles.full_name} className="w-full h-full object-cover" />
                ) : (
                  entry.profiles?.full_name?.[0] || '?'
                )}
              </div>
              
              <div>
                <p className="font-semibold text-sm text-slate-900">{entry.profiles?.full_name || 'Unknown User'}</p>
                <p className="text-xs text-slate-500">Level {entry.level}</p>
              </div>
            </div>
            
            <div className="font-bold text-indigo-600">
              {entry.xp} XP
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
