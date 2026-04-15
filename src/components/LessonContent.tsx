import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Play, FileText, HelpCircle, CheckCircle, ChevronRight, ChevronLeft, Loader2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

import { useAuth } from '../context/AuthContext';

interface LessonContentProps {
  lessonId: string;
  onComplete: (score?: number) => void;
  isCompleted: boolean;
}

export const LessonContent: React.FC<LessonContentProps> = ({ lessonId, onComplete, isCompleted }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [activityProgress, setActivityProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [lessonId]);

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });
    
    if (data) setActivities(data);

    if (user) {
      const { data: progressData } = await supabase
        .from('activity_progress')
        .select('activity_id, status')
        .eq('user_id', user.id)
        .in('activity_id', data?.map(a => a.activity_id) || []);
      
      const progressMap: Record<string, boolean> = {};
      progressData?.forEach(p => {
        if (p.status === 'completed') progressMap[p.activity_id] = true;
      });
      setActivityProgress(progressMap);
    }

    setLoading(false);
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizAnswers({});
  };

  const markActivityComplete = async (activityId: string, score?: number) => {
    if (!user) return;
    
    setActivityProgress(prev => ({ ...prev, [activityId]: true }));
    
    await supabase.from('activity_progress').upsert({
      user_id: user.id,
      activity_id: activityId,
      status: 'completed',
      score: score || null,
      completed_at: new Date().toISOString()
    }, { onConflict: 'user_id,activity_id' });
  };

  const handleQuizSubmit = async (activityId: string, questions: any[]) => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (quizAnswers[`${activityId}_${idx}`] === q.correctAnswer) {
        correct++;
      }
    });
    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    
    if (score >= 70) {
      await markActivityComplete(activityId, score);
      onComplete(score);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {activities.map((activity, index) => (
        <motion.div
          key={activity.activity_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </span>
              <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                {activity.activity_type}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {activity.time_estimate_minutes && (
                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                  {activity.time_estimate_minutes} min
                </span>
              )}
              {activity.is_required ? (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                  Required
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                  Optional
                </span>
              )}
            </div>
          </div>

          {activity.activity_type === 'video' && (
            <div className="aspect-video bg-slate-900">
              {activity.content.video_url ? (
                <iframe
                  src={activity.content.video_url.replace('watch?v=', 'embed/')}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center relative group">
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 group-hover:bg-slate-900/20 transition-all cursor-pointer">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl group-hover:scale-110 transition-all">
                      <Play className="w-10 h-10 text-white fill-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white/80 text-sm font-medium">
                    <span>Video Lesson</span>
                    <span>{activity.time_estimate_minutes ? `${activity.time_estimate_minutes} min` : '12:45'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {(activity.activity_type === 'text' || activity.activity_type === 'html') && (
            <div className="p-8 prose prose-slate max-w-none">
              <div dangerouslySetInnerHTML={{ __html: activity.content.text || activity.content.html || '' }} />
            </div>
          )}

          {activity.activity_type === 'link' && (
            <div className="p-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{activity.title || 'External Resource'}</h3>
                <p className="text-slate-500 mt-1">{activity.content.description || 'Click the link to view this resource.'}</p>
              </div>
              <a 
                href={activity.content.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
              >
                Open Link
              </a>
            </div>
          )}

          {activity.activity_type === 'quiz' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{activity.title || 'Knowledge Check'}</h3>
                  <p className="text-slate-500 text-sm">Test your understanding of this lesson.</p>
                </div>
              </div>

              <div className="space-y-8">
                {activity.content.questions?.map((q: any, qIdx: number) => (
                  <div key={qIdx} className="space-y-4">
                    <p className="font-bold text-slate-900 text-lg">{qIdx + 1}. {q.question}</p>
                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((option: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [`${activity.activity_id}_${qIdx}`]: oIdx })}
                          className={cn(
                            "w-full p-4 rounded-xl border text-left font-medium transition-all flex items-center justify-between",
                            quizAnswers[`${activity.activity_id}_${qIdx}`] === oIdx 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                            quizSubmitted && q.correctAnswer === oIdx && "bg-emerald-50 border-emerald-200 text-emerald-700",
                            quizSubmitted && quizAnswers[`${activity.activity_id}_${qIdx}`] === oIdx && q.correctAnswer !== oIdx && "bg-red-50 border-red-200 text-red-700"
                          )}
                        >
                          {option}
                          {quizSubmitted && q.correctAnswer === oIdx && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={() => handleQuizSubmit(activity.activity_id, activity.content.questions || [])}
                  className="mt-10 w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Submit Quiz
                </button>
              ) : (
                <div className={cn(
                  "mt-10 p-6 rounded-2xl border flex items-center justify-between",
                  quizScore! >= 70 ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-red-50 border-red-100 text-red-900"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      quizScore! >= 70 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    )}>
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-2xl font-black">{quizScore}%</div>
                      <div className="text-sm font-bold uppercase tracking-wider opacity-60">
                        {quizScore! >= 70 ? 'Passed' : 'Try Again'}
                      </div>
                    </div>
                  </div>
                  {quizScore! < 70 && (
                    <button 
                      onClick={() => {
                        setQuizSubmitted(false);
                        setQuizAnswers({});
                      }}
                      className="px-6 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-all"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {activity.activity_type === 'flashcards' && (
            <div className="p-8 text-center bg-indigo-50">
              <h3 className="text-xl font-bold text-slate-900 mb-4">{activity.title || 'Flashcards'}</h3>
              <p className="text-slate-600 mb-6">Review key concepts with interactive flashcards.</p>
              <button className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all">
                Start Flashcards
              </button>
            </div>
          )}

          {activity.activity_type === 'embed' && (
            <div className="aspect-video bg-slate-100">
              {activity.content.embed_url ? (
                <iframe
                  src={activity.content.embed_url}
                  className="w-full h-full"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  No embed URL provided
                </div>
              )}
            </div>
          )}

          {activity.activity_type === 'challenge' && (
            <div className="p-8 border-l-4 border-amber-500 bg-amber-50/50">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Challenge: {activity.title}</h3>
              <p className="text-slate-700 mb-6">{activity.content.description}</p>
              <button className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all">
                Start Challenge
              </button>
            </div>
          )}

          {activity.activity_type !== 'quiz' && (
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
              {activityProgress[activity.activity_id] ? (
                <div className="flex items-center gap-2 text-emerald-600 font-bold px-4 py-2">
                  <CheckCircle className="w-5 h-5" />
                  Completed
                </div>
              ) : (
                <button
                  onClick={() => markActivityComplete(activity.activity_id)}
                  className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm"
                >
                  Mark as Complete
                </button>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {!isCompleted && activities.every(a => a.activity_type !== 'quiz') && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => onComplete()}
            className="px-10 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center gap-3"
          >
            <CheckCircle className="w-6 h-6" />
            Mark Lesson as Complete
          </button>
        </div>
      )}
    </div>
  );
};
