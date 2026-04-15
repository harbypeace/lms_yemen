import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Book, ChevronLeft, ChevronRight, CheckCircle, Play, FileText, HelpCircle, Loader2, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { LessonContent } from './LessonContent';
import { CourseLeaderboard } from './CourseLeaderboard';
import { QuizViewer } from './QuizViewer';
import { QuizManager } from './QuizManager';
import { LessonAdaptiveEditor } from './LessonAdaptiveEditor';
import { NoteSection } from './NoteSection';
import { useLMSEvents } from '../hooks/useLMSEvents';
import { adaptiveEngine } from '../services/adaptiveEngine';

interface CourseViewerProps {
  courseId: string;
  onBack: () => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({ courseId, onBack }) => {
  const { user, progress, setProgress, memberships, activeTenant } = useAuth();
  const { trackLessonStart, trackLessonComplete } = useLMSEvents();
  
  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdmin = ['super_admin', 'school_admin', 'teacher'].includes(myRole || '');

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz' | 'notes' | 'manage'>('content');
  const [prerequisitesMet, setPrerequisitesMet] = useState(true);

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

      // Check prerequisites
      if (courseData.prerequisites && courseData.prerequisites.length > 0 && user) {
        const { data: completed } = await supabase
          .from('learning_events')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('event_type', 'course_completed')
          .in('course_id', courseData.prerequisites);
        
        const completedIds = completed?.map(c => c.course_id) || [];
        const allMet = courseData.prerequisites.every((id: string) => completedIds.includes(id));
        setPrerequisitesMet(allMet);
      } else {
        setPrerequisitesMet(true);
      }

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
        trackLessonStart(selectedLessonId, course.id);
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
        .from('user_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          status: 'completed',
          score: score || null,
          completion_date: new Date().toISOString()
        }, {
          onConflict: 'user_id,lesson_id'
        });

      if (error) throw error;

      // Track with Unified Event System (handles xAPI, Gamification, and Webhooks)
      const lesson = modules.flatMap(m => m.lessons).find(l => l.id === lessonId);
      if (lesson) {
        await trackLessonComplete(lessonId, course.id);
      }

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

  if (!prerequisitesMet && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Course Locked</h2>
        <p className="text-slate-500 mb-8">You must complete the prerequisite courses before accessing this content.</p>
        <button 
          onClick={onBack}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Back to Courses
        </button>
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
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Adaptive Engine Settings</h3>
                    <LessonAdaptiveEditor lessonId={selectedLesson.id} tenantId={activeTenant?.id || ''} />
                  </div>
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
                  onClick={async () => {
                    if (!user || !selectedLessonId || !activeTenant) return;
                    
                    const nextId = await adaptiveEngine.getNextLesson(user.id, selectedLessonId, activeTenant.id);
                    
                    if (nextId) {
                      setSelectedLessonId(nextId);
                      setActiveTab('content');
                    } else {
                      const allLessons = modules.flatMap(m => m.lessons);
                      const idx = allLessons.findIndex(l => l.id === selectedLessonId);
                      if (idx < allLessons.length - 1) setSelectedLessonId(allLessons[idx + 1].id);
                    }
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
