import React, { useEffect, useState } from 'react';
import { xapiLite } from '../services/xapiService';
import { XApiStatement } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, User, Clock, Award } from 'lucide-react';

export const PublicActivityFeed: React.FC<{ activityId?: string }> = ({ activityId }) => {
  const [statements, setStatements] = useState<(XApiStatement & { profiles: { full_name: string, avatar_url: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicActivity();
    const interval = setInterval(fetchPublicActivity, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [activityId]);

  const fetchPublicActivity = async () => {
    try {
      const data = await xapiLite.getPublic(activityId);
      if (data.success) {
        setStatements(data.statements);
      }
    } catch (err) {
      console.error('Error fetching public activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const getVerbDisplay = (verb: string) => {
    switch (verb) {
      case 'start': return 'started';
      case 'end': return 'completed';
      case 'score': return 'scored';
      case 'store': return 'interacted with';
      default: return verb;
    }
  };

  if (loading && statements.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-900">Public Learning Feed</h3>
      </div>
      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {statements.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>No public activity yet.</p>
            </div>
          ) : (
            statements.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 flex gap-3 items-start hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                  {s.profiles?.avatar_url ? (
                    <img src={s.profiles.avatar_url} alt={s.profiles.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-bold">{s.profiles?.full_name || 'Someone'}</span>
                    {' '}
                    <span className="text-slate-500">{getVerbDisplay(s.verb)}</span>
                    {' '}
                    <span className="font-medium text-indigo-600">{s.activity_id}</span>
                  </p>
                  {s.verb === 'score' && (
                    <div className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <Award className="w-3 h-3" />
                      <span>Score: {s.score}/{s.max_score}</span>
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
