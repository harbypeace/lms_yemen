import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Edit2, Save, X, PlusCircle, ListChecks, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Quiz {
  quiz_id: string;
  quiz_title: string;
  description: string;
  passing_score: number;
}

interface Question {
  question_id?: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface QuizManagerProps {
  targetId: string;
  targetType: string;
}

export const QuizManager: React.FC<QuizManagerProps> = ({ targetId, targetType }) => {
  const { user, activeTenant } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [quizForm, setQuizForm] = useState({ quiz_title: '', description: '', passing_score: 70 });

  useEffect(() => {
    fetchQuiz();
  }, [targetId, targetType]);

  const fetchQuiz = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('lesson_id', targetId)
        .maybeSingle();

      if (data) {
        setQuiz(data);
        setQuizForm({ quiz_title: data.quiz_title, description: data.description || '', passing_score: data.passing_score });
        
        const { data: qData } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', data.quiz_id)
          .order('order_index', { ascending: true });
        
        setQuestions(qData || []);
      } else {
        setQuiz(null);
        setQuestions([]);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!activeTenant) return;

    try {
      let quizId = quiz?.quiz_id;

      if (quizId) {
        await supabase
          .from('quizzes')
          .update(quizForm)
          .eq('quiz_id', quizId);
      } else {
        const { data, error } = await supabase
          .from('quizzes')
          .insert([{
            ...quizForm,
            tenant_id: activeTenant.id,
            lesson_id: targetId
          }])
          .select()
          .single();
        
        if (error) throw error;
        quizId = data.quiz_id;
      }

      // Save questions
      // Simple approach: delete all and re-insert
      if (quizId) {
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
        if (questions.length > 0) {
          const questionsToInsert = questions.map((q, idx) => {
            const { question_id, ...rest } = q;
            return {
              ...rest,
              quiz_id: quizId,
              order_index: idx
            };
          });
          await supabase.from('quiz_questions').insert(questionsToInsert);
        }
      }

      setEditing(false);
      fetchQuiz();
    } catch (err) {
      console.error('Error saving quiz:', err);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: ''
    }]);
  };

  const updateQuestion = (idx: number, field: keyof Question, value: any) => {
    const newQuestions = [...questions];
    newQuestions[idx] = { ...newQuestions[idx], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const newQuestions = [...questions];
    const newOptions = [...newQuestions[qIdx].options];
    newOptions[oIdx] = value;
    newQuestions[qIdx].options = newOptions;
    setQuestions(newQuestions);
  };

  if (loading) return <div className="p-4">Loading...</div>;

  if (!editing && !quiz) {
    return (
      <div className="p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
        <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">No Quiz Created</h3>
        <p className="text-slate-500 mb-6">Add a quiz to this {targetType} to test student knowledge.</p>
        <button
          onClick={() => {
            setEditing(true);
            setQuizForm({ quiz_title: `Quiz for ${targetType}`, description: '', passing_score: 70 });
          }}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          Create Quiz
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{quiz.quiz_title}</h3>
            <p className="text-slate-500 text-sm">{questions.length} Questions • {quiz.passing_score}% Passing Score</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
          >
            <Edit2 className="w-4 h-4" />
            Edit Quiz
          </button>
        </div>
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900">{i + 1}. {q.question_text}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={cn(
                    "text-xs p-2 rounded-lg border",
                    opt === q.correct_answer ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" : "bg-white border-slate-100 text-slate-500"
                  )}>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Quiz Settings</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveQuiz}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Save className="w-4 h-4" />
              Save Quiz
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Quiz Title</label>
            <input
              type="text"
              value={quizForm.quiz_title}
              onChange={(e) => setQuizForm({ ...quizForm, quiz_title: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Passing Score (%)</label>
            <input
              type="number"
              value={quizForm.passing_score}
              onChange={(e) => setQuizForm({ ...quizForm, passing_score: parseInt(e.target.value) })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Questions</h3>
          <button
            onClick={addQuestion}
            className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            Add Question
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <motion.div
            key={qIdx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative group"
          >
            <button
              onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {qIdx + 1}
              </span>
              <input
                type="text"
                placeholder="Enter your question..."
                value={q.question_text}
                onChange={(e) => updateQuestion(qIdx, 'question_text', e.target.value)}
                className="flex-1 bg-transparent border-b-2 border-slate-100 focus:border-indigo-500 outline-none py-2 text-lg font-bold text-slate-900 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuestion(qIdx, 'correct_answer', opt)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      q.correct_answer === opt && opt !== ''
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {q.correct_answer === opt && opt !== '' && <ListChecks className="w-4 h-4" />}
                  </button>
                  <input
                    type="text"
                    placeholder={`Option ${oIdx + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-xl border outline-none transition-all",
                      q.correct_answer === opt && opt !== ''
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-slate-100 focus:border-indigo-500"
                    )}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
