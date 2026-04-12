import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Book, ChevronLeft, ChevronRight, CheckCircle, Play, FileText, HelpCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { LessonContent } from './LessonContent';
import { CourseLeaderboard } from './CourseLeaderboard';
import { QuizViewer } from './QuizViewer';
import { QuizManager } from './QuizManager';
import { NoteSection } from './NoteSection';
import { useGamification } from '../hooks/useGamification';
import { xapiLite } from '../services/xapiService';

interface CourseViewerProps {
  courseId: string;
  onBack: () => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({ courseId, onBack }) => {
  const { user, progress, setProgress, memberships, activeTenant } = useAuth();
  const { trackEvent, checkCourseCompletion } = useGamification();
  
  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdmin = ['super_admin', 'school_admin', 'teacher'].includes(myRole || '');

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz' | 'notes' | 'manage'>('content');

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

  useEffect(() => {
    if (selectedLessonId && course) {
      const lesson = modules.flatMap(m => m.lessons).find(l => l.id === selectedLessonId);
      if (lesson) {
        xapiLite.start({
          activityId: lesson.title,
          activityType: 'lesson',
          tenantId: course.tenant_id,
          metadata: { lessonId: selectedLessonId, courseId: course.id }
        });
      }
    }
  }, [selectedLessonId, course]);

  const toggleLessonCompletion = async (lessonId: string, score?: number) => {
    if (!user || !course) return;
    
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

      // Track xAPI Lite end
      const lesson = modules.flatMap(m => m.lessons).find(l => l.id === lessonId);
      if (lesson) {
        xapiLite.end({
          activityId: lesson.title,
          activityType: 'lesson',
          success: true,
          completion: true,
          tenantId: course.tenant_id,
          isPublic: true, // Make some events public for the feed
          metadata: { lessonId, courseId: course.id, score }
        });

        if (score) {
          xapiLite.score({
            activityId: lesson.title,
            score: score,
            activityType: 'lesson',
            tenantId: course.tenant_id,
            isPublic: true,
            metadata: { lessonId, courseId: course.id }
          });
        }
      }

      setProgress(prev => ({
        ...prev,
        [lessonId]: true
      }));

      // Track gamification event if it wasn't already completed
      if (!isCompleted) {
        // Find the unit ID for this lesson
        const unitId = modules.find(m => m.lessons.some((l: any) => l.id === lessonId))?.id;
        
        await trackEvent({
          eventType: 'lesson_completed',
          entityType: 'lesson',
          entityId: lessonId,
          courseId: courseId,
          unitId: unitId,
          lessonId: lessonId,
          metadata: { score }
        });

        // Check if course is now fully completed
        await checkCourseCompletion(courseId);
      }
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
          <CourseLeaderboard courseId={courseId} />
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

                <div className="flex items-center gap-6 mt-8 border-b border-slate-100">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={cn(
                      "pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                      activeTab === 'content' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    Lesson
                  </button>
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className={cn(
                      "pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                      activeTab === 'quiz' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    Quiz
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={cn(
                      "pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                      activeTab === 'notes' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    Notes
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setActiveTab('manage')}
                      className={cn(
                        "pb-4 text-sm font-bold uppercase tracking-widest transition-all border-b-2",
                        activeTab === 'manage' ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"
                      )}
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>

              {activeTab === 'content' && (
                <LessonContent 
                  lessonId={selectedLesson.id} 
                  isCompleted={!!progress[selectedLesson.id]}
                  onComplete={(score) => toggleLessonCompletion(selectedLesson.id, score)}
                />
              )}

              {activeTab === 'quiz' && (
                <QuizViewer targetId={selectedLesson.id} targetType="lesson" />
              )}

              {activeTab === 'notes' && (
                <NoteSection targetId={selectedLesson.id} targetType="lesson" />
              )}

              {activeTab === 'manage' && isAdmin && (
                <div className="space-y-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Lesson Quiz Management</h3>
                    <QuizManager targetId={selectedLesson.id} targetType="lesson" />
                  </div>
                </div>
              )}

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
