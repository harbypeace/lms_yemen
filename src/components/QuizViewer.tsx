import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, ChevronRight, RefreshCw, Trophy, AlertCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLMSEvents } from '../hooks/useLMSEvents';

interface Question {
  question_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface Quiz {
  quiz_id: string;
  quiz_title: string;
  description: string;
  passing_score: number;
  tenant_id: string;
}

interface QuizViewerProps {
  targetId: string;
  targetType: string;
  onComplete?: (score: number, passed: boolean) => void;
}

export const QuizViewer: React.FC<QuizViewerProps> = ({ targetId, targetType, onComplete }) => {
  const { user } = useAuth();
  const { trackQuizResult } = useLMSEvents();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [targetId, targetType]);

  const fetchQuiz = async () => {
    setLoading(true);
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', targetId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      const { data: questionsData, error: qError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizData.quiz_id)
        .order('order_index', { ascending: true });

      if (qError) throw qError;
      setQuestions(questionsData || []);
    } catch (err) {
      console.error('Error fetching quiz:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!user || !quiz) return;
    setSubmitting(true);

    let correctCount = 0;
    questions.forEach(q => {
      if (answers[q.question_id] === q.correct_answer) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    const passed = finalScore >= quiz.passing_score;

    try {
      const { error } = await supabase
        .from('quiz_submissions')
        .insert([{
          user_id: user.id,
          quiz_id: quiz.quiz_id,
          score: finalScore,
          total_questions: questions.length,
          passed,
          answers
        }]);

      if (error) throw error;

      // Track with Unified Event System (handles xAPI, Gamification, and Webhooks)
      await trackQuizResult(quiz.quiz_id, finalScore, passed, targetId);

      setScore(finalScore);
      setShowResults(true);
      if (onComplete) onComplete(finalScore, passed);
    } catch (err) {
      console.error('Error submitting quiz:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;
  
  if (!quiz) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
        <HelpCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900">No Quiz Available</h3>
        <p className="text-slate-500 mt-2">There is no assessment for this lesson yet.</p>
      </div>
    );
  }

  if (showResults) {
    const passed = score >= quiz.passing_score;
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-xl text-center"
      >
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg",
          passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
        )}>
          {passed ? <Trophy className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
        </div>
        <h3 className="text-3xl font-black text-slate-900 mb-2">
          {passed ? 'Congratulations!' : 'Keep Practicing!'}
        </h3>
        <p className="text-slate-500 font-medium mb-8">
          You scored <span className="text-indigo-600 font-bold">{score}%</span> on the {quiz.quiz_title}.
          {passed ? ' You have passed this assessment.' : ` You need ${quiz.passing_score}% to pass.`}
        </p>
        <button
          onClick={() => {
            setShowResults(false);
            setCurrentQuestionIndex(0);
            setAnswers({});
          }}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Try Again
        </button>
      </motion.div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
        <HelpCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900">Quiz is Empty</h3>
        <p className="text-slate-500 mt-2">This quiz has no questions yet.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{quiz.quiz_title}</h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.question_id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h4 className="text-xl font-bold text-slate-900">{currentQuestion.question_text}</h4>
            
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(currentQuestion.question_id, option)}
                  className={cn(
                    "w-full p-4 rounded-2xl border-2 text-left transition-all font-medium flex items-center justify-between group",
                    answers[currentQuestion.question_id] === option
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-slate-100 hover:border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span>{option}</span>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                    answers[currentQuestion.question_id] === option
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 group-hover:border-slate-300"
                  )}>
                    {answers[currentQuestion.question_id] === option && <CheckCircle className="w-4 h-4" />}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <button
          disabled={currentQuestionIndex === 0}
          onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          className="text-slate-500 font-bold hover:text-slate-900 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        
        {currentQuestionIndex === questions.length - 1 ? (
          <button
            disabled={!answers[currentQuestion.question_id] || submitting}
            onClick={handleSubmit}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Finish Quiz'}
          </button>
        ) : (
          <button
            disabled={!answers[currentQuestion.question_id]}
            onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            Next Question
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
