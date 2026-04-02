import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Play, FileText, HelpCircle, CheckCircle, ChevronRight, ChevronLeft, Loader2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LessonContentProps {
  lessonId: string;
  onComplete: (score?: number) => void;
  isCompleted: boolean;
}

export const LessonContent: React.FC<LessonContentProps> = ({ lessonId, onComplete, isCompleted }) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  useEffect(() => {
    fetchBlocks();
  }, [lessonId]);

  const fetchBlocks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lesson_blocks')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index', { ascending: true });
    
    if (data) setBlocks(data);
    setLoading(false);
    setQuizSubmitted(false);
    setQuizScore(null);
    setQuizAnswers({});
  };

  const handleQuizSubmit = (blockId: string, questions: any[]) => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (quizAnswers[`${blockId}_${idx}`] === q.correctAnswer) {
        correct++;
      }
    });
    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
    
    if (score >= 70) {
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
      {blocks.map((block) => (
        <motion.div
          key={block.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {block.type === 'video' && (
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative group">
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 group-hover:bg-slate-900/20 transition-all cursor-pointer">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 shadow-2xl group-hover:scale-110 transition-all">
                  <Play className="w-10 h-10 text-white fill-white" />
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white/80 text-sm font-medium">
                <span>Video Lesson</span>
                <span>12:45</span>
              </div>
            </div>
          )}

          {block.type === 'text' && (
            <div className="p-8 prose prose-slate max-w-none">
              <div dangerouslySetInnerHTML={{ __html: block.content_json.text }} />
            </div>
          )}

          {block.type === 'quiz' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Knowledge Check</h3>
                  <p className="text-slate-500 text-sm">Test your understanding of this lesson.</p>
                </div>
              </div>

              <div className="space-y-8">
                {block.content_json.questions.map((q: any, qIdx: number) => (
                  <div key={qIdx} className="space-y-4">
                    <p className="font-bold text-slate-900 text-lg">{qIdx + 1}. {q.question}</p>
                    <div className="grid grid-cols-1 gap-3">
                      {q.options.map((option: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers({ ...quizAnswers, [`${block.id}_${qIdx}`]: oIdx })}
                          className={cn(
                            "w-full p-4 rounded-xl border text-left font-medium transition-all flex items-center justify-between",
                            quizAnswers[`${block.id}_${qIdx}`] === oIdx 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100",
                            quizSubmitted && q.correctAnswer === oIdx && "bg-emerald-50 border-emerald-200 text-emerald-700",
                            quizSubmitted && quizAnswers[`${block.id}_${qIdx}`] === oIdx && q.correctAnswer !== oIdx && "bg-red-50 border-red-200 text-red-700"
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
                  onClick={() => handleQuizSubmit(block.id, block.content_json.questions)}
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
        </motion.div>
      ))}

      {!isCompleted && blocks.every(b => b.type !== 'quiz') && (
        <div className="flex justify-center pt-8">
          <button
            onClick={onComplete}
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
