import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Book, ChevronLeft, CheckCircle, Play, FileText, HelpCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { LessonContent } from './LessonContent';

interface CourseViewerProps {
  courseId: string;
  onBack: () => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({ courseId, onBack }) => {
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      // 1. Get course details
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      setCourse(courseData);

      // 2. Get modules and lessons
      const { data: modulesData } = await supabase
        .from('modules')
        .select('*, lessons(*)')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
      
      // Sort lessons within modules
      const sortedModules = modulesData?.map(m => ({
        ...m,
        lessons: m.lessons?.sort((a: any, b: any) => a.order_index - b.order_index) || []
      })) || [];
      
      setModules(sortedModules);

      // 3. Get student progress
      const { data: progressData } = await supabase
        .from('progress')
        .select('lesson_id, completed')
        .eq('user_id', user?.id);
      
      const progressMap: Record<string, boolean> = {};
      progressData?.forEach(p => {
        progressMap[p.lesson_id] = p.completed;
      });
      setProgress(progressMap);

      // Select first lesson by default if none selected
      if (!selectedLessonId && sortedModules[0]?.lessons[0]) {
        setSelectedLessonId(sortedModules[0].lessons[0].id);
      }

    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLessonCompletion = async (lessonId: string, score?: number) => {
    if (!user) return;
    
    const isCompleted = !!progress[lessonId];
    if (isCompleted && !score) return; // Don't allow un-completing, but allow updating score

    setCompleting(lessonId);

    try {
      const { error } = await supabase
        .from('progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          completed: true,
          score: score || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,lesson_id'
        });

      if (error) throw error;

      setProgress(prev => ({
        ...prev,
        [lessonId]: true
      }));
    } catch (error) {
      console.error('Error updating progress:', error);
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const selectedLesson = modules.flatMap(m => m.lessons).find(l => l.id === selectedLessonId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Courses
        </button>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Course Progress</div>
            <div className="text-lg font-black text-slate-900">
              {Math.round((Object.values(progress).filter(Boolean).length / (modules.reduce((acc, m) => acc + m.lessons.length, 0) || 1)) * 100)}%
            </div>
          </div>
          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(Object.values(progress).filter(Boolean).length / (modules.reduce((acc, m) => acc + m.lessons.length, 0) || 1)) * 100}%` }}
              className="h-full bg-indigo-600"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Book className="w-4 h-4 text-indigo-600" />
                Course Content
              </h3>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {modules.map((module, mIdx) => (
                <div key={module.id} className="border-b border-slate-100 last:border-0">
                  <div className="p-3 bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Module {mIdx + 1}: {module.title}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {module.lessons.map((lesson: any) => (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLessonId(lesson.id)}
                        className={cn(
                          "w-full p-4 flex items-center gap-3 text-left transition-all hover:bg-slate-50",
                          selectedLessonId === lesson.id ? "bg-indigo-50 border-l-4 border-indigo-600" : "border-l-4 border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                          progress[lesson.id] ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                        )}>
                          {progress[lesson.id] ? <CheckCircle className="w-4 h-4" /> : <Play className="w-3 h-3" />}
                        </div>
                        <span className={cn(
                          "text-sm font-semibold",
                          selectedLessonId === lesson.id ? "text-indigo-700" : "text-slate-600"
                        )}>
                          {lesson.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lesson Content Area */}
        <div className="lg:col-span-3 space-y-8">
          {selectedLesson ? (
            <>
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Lesson {selectedLesson.order_index}
                  </span>
                  {progress[selectedLesson.id] && (
                    <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                      <CheckCircle className="w-3 h-3" />
                      Completed
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-slate-900">{selectedLesson.title}</h1>
              </div>

              <LessonContent 
                lessonId={selectedLesson.id} 
                isCompleted={!!progress[selectedLesson.id]}
                onComplete={(score) => toggleLessonCompletion(selectedLesson.id, score)}
              />

              {/* Navigation Footer */}
              <div className="flex items-center justify-between pt-8 border-t border-slate-100">
                <button
                  onClick={() => {
                    const allLessons = modules.flatMap(m => m.lessons);
                    const idx = allLessons.findIndex(l => l.id === selectedLessonId);
                    if (idx > 0) setSelectedLessonId(allLessons[idx - 1].id);
                  }}
                  disabled={modules.flatMap(m => m.lessons).findIndex(l => l.id === selectedLessonId) === 0}
                  className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous Lesson
                </button>
                <button
                  onClick={() => {
                    const allLessons = modules.flatMap(m => m.lessons);
                    const idx = allLessons.findIndex(l => l.id === selectedLessonId);
                    if (idx < allLessons.length - 1) setSelectedLessonId(allLessons[idx + 1].id);
                  }}
                  disabled={modules.flatMap(m => m.lessons).findIndex(l => l.id === selectedLessonId) === modules.flatMap(m => m.lessons).length - 1}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold disabled:opacity-30 transition-all"
                >
                  Next Lesson
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white p-20 rounded-2xl border border-slate-200 shadow-sm text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Select a lesson to begin</h3>
              <p className="text-slate-500 mt-2">Choose a lesson from the sidebar to start learning.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
