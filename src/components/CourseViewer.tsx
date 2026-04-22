import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Book, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  Play, 
  FileText, 
  HelpCircle, 
  Loader2, 
  Lock,
  Menu,
  X,
  LayoutGrid,
  ChevronDown,
  Settings as SettingsIcon,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LearningContent } from './LearningContent';
import { CourseLeaderboard } from './CourseLeaderboard';
import { QuizViewer } from './QuizViewer';
import { QuizManager } from './QuizManager';
import { LessonAdaptiveEditor } from './LessonAdaptiveEditor';
import { NoteSection } from './NoteSection';
import { useLMSEvents } from '../hooks/useLMSEvents';
import { adaptiveEngine } from '../services/adaptiveEngine';

interface CourseViewerProps {
  onBack: () => void;
}

export const CourseViewer: React.FC<CourseViewerProps> = ({ onBack }) => {
  const { courseSlug, subCourseSlug, unitSlug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const { user, progress, setProgress, memberships, activeTenant } = useAuth();
  const { trackLessonStart, trackLessonComplete } = useLMSEvents();
  
  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdmin = ['super_admin', 'school_admin', 'teacher'].includes(myRole || '');

  const [course, setCourse] = useState<any>(null);
  const [subCourses, setSubCourses] = useState<any[]>([]);
  const [directModules, setDirectModules] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'quiz' | 'notes' | 'manage'>('content');
  const [prerequisitesMet, setPrerequisitesMet] = useState(true);
  const [missingPrereqTitles, setMissingPrereqTitles] = useState<string[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSubCourseId, setActiveSubCourseId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{type: 'subcourse' | 'unit' | 'lesson', data: any} | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const unitScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCourseData();
  }, [courseSlug]);

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/courses-full/${courseSlug}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      setCourse(result.course);
      setSubCourses(result.subCourses);
      setDirectModules(result.directModules);
      setPermissions(result.permissions || []);

      // Check prerequisites
      if (result.course.prerequisites && result.course.prerequisites.length > 0 && user) {
        const { data: completed } = await supabase
          .from('learning_events')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('event_type', 'course_completed')
          .in('course_id', result.course.prerequisites);
        
        const completedIds = completed?.map(c => c.course_id) || [];
        const missingIds = result.course.prerequisites.filter((id: string) => !completedIds.includes(id));
        
        if (missingIds.length > 0) {
          const { data: missingCourses } = await supabase
            .from('courses')
            .select('title')
            .in('id', missingIds);
          setMissingPrereqTitles(missingCourses?.map(c => c.title) || []);
        }

        setPrerequisitesMet(missingIds.length === 0);
      } else {
        setPrerequisitesMet(true);
      }

    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Derived state based on URL
  const allModules = [...directModules, ...subCourses.flatMap(sc => sc.modules)];
  const allLessons = allModules.flatMap(m => m.lessons);

  const selectedSubCourse = subCourses.find(sc => sc.slug === subCourseSlug || sc.id === subCourseSlug);
  const selectedModule = allModules.find(m => m.slug === unitSlug || m.id === unitSlug);
  const selectedLesson = allLessons.find(l => l.slug === lessonSlug || l.id === lessonSlug);

  const viewLevel = lessonSlug ? 'lesson' : unitSlug ? 'unit' : subCourseSlug ? 'subcourse' : 'course';

  useEffect(() => {
    if (selectedLesson && course) {
      trackLessonStart(selectedLesson.id, course.id);
      // Sync active state for sidebar
      if (selectedModule) setActiveModuleId(selectedModule.id);
      if (selectedSubCourse) setActiveSubCourseId(selectedSubCourse.id);
    }
  }, [selectedLesson?.id, course?.id]);

  const toggleLessonCompletion = async (lessonId: string, score?: number) => {
    if (!user || !course) return;
    
    const isCompleted = !!progress[lessonId];
    if (isCompleted && !score) return;

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

      await trackLessonComplete(lessonId, course.id);

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
        <p className="text-slate-500 mb-6">You must complete the following prerequisite courses before accessing this content:</p>
        
        <div className="max-w-md mx-auto mb-10 space-y-3">
          {missingPrereqTitles.map((title, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <span className="font-semibold text-slate-700">{title}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={onBack}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !activeTenant) return;
    setSavingEdit(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let endpoint = '';
      if (editTarget.type === 'subcourse') endpoint = `/api/sub-courses/${editTarget.data.id}`;
      else if (editTarget.type === 'unit') endpoint = `/api/modules/${editTarget.data.id}`;
      else endpoint = `/api/lessons/${editTarget.data.id}`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...editTarget.data,
          tenantId: activeTenant.id
        })
      });

      if (!response.ok) throw new Error('Failed to save changes');

      setIsEditModalOpen(false);
      setEditTarget(null);
      fetchCourseData(); // Refresh data
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const getSubCoursePath = (sc: any) => `/courses/${courseSlug}/${sc.slug || sc.id}`;
  const getUnitPath = (sc: any, m: any) => sc 
    ? `/courses/${courseSlug}/${sc.slug || sc.id}/${m.slug || m.id}`
    : `/courses/${courseSlug}/${m.slug || m.id}`;
  const getLessonPath = (sc: any, m: any, l: any) => sc
    ? `/courses/${courseSlug}/${sc.slug || sc.id}/${m.slug || m.id}/${l.slug || l.id}`
    : `/courses/${courseSlug}/${m.slug || m.id}/${l.slug || l.id}`;

  return (
    <div className="space-y-6">
      {/* Course Header & Top Toolbar */}
      <div className="bg-white p-4 lg:p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-0 z-30 lg:static">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-50 rounded-xl transition-all"
            >
              <ChevronLeft className="w-6 h-6 text-slate-400" />
            </button>
            <Link 
              to={`/courses/${courseSlug}`}
              className="text-left hover:bg-slate-50 p-2 rounded-2xl transition-all"
            >
              <h1 className="text-lg lg:text-2xl font-black text-slate-900 line-clamp-1">{course?.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  <LayoutGrid className="w-3 h-3" />
                  {allModules.length} Units
                </div>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(Object.values(progress).filter(Boolean).length / (allLessons.length || 1)) * 100}%` }}
                    className="h-full bg-indigo-600"
                  />
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0" ref={unitScrollRef}>
            {subCourses.map((sc) => (
              <Link
                key={sc.id}
                to={getSubCoursePath(sc)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2",
                  activeSubCourseId === sc.id 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                    : "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
                )}
              >
                <Layers className="w-3 h-3" />
                {sc.title}
              </Link>
            ))}
          </div>

          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
          >
            <Menu className="w-5 h-5" />
            Contents
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className={cn(
          "fixed lg:static inset-0 z-50 lg:z-auto transition-transform lg:transform-none bg-black/50 lg:bg-transparent lg:col-span-1",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )} onClick={() => setIsSidebarOpen(false)}>
          <div 
            className="w-4/5 lg:w-full h-full bg-white lg:bg-transparent lg:rounded-none overflow-hidden flex flex-col shadow-2xl lg:shadow-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 lg:hidden flex items-center justify-between">
              <h2 className="font-black text-xl text-slate-900">Course Index</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 lg:p-0 space-y-6 lg:space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hidden lg:block">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Book className="w-4 h-4 text-indigo-600" />
                    Explorer
                  </h3>
                </div>
                <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-50">
                  {/* Direct Modules */}
                  {directModules.map((module, mIdx) => (
                    <div key={module.id} className="group">
                      <button 
                        onClick={() => setActiveModuleId(activeModuleId === module.id ? null : module.id)}
                        className={cn(
                          "w-full p-4 flex items-center justify-between text-left transition-all",
                          activeModuleId === module.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                        )}
                      >
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit {mIdx + 1}</div>
                          <div className="text-sm font-bold text-slate-900 truncate">{module.title}</div>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", activeModuleId === module.id ? "rotate-180" : "")} />
                      </button>
                      <AnimatePresence>
                        {activeModuleId === module.id && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-white overflow-hidden divide-y divide-slate-50">
                            {module.lessons.map((lesson: any) => (
                              <Link
                                key={lesson.id}
                                to={getLessonPath(null, module, lesson)}
                                className={cn(
                                  "w-full p-4 flex items-center gap-3 text-left transition-all group/item",
                                  lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-50 border-l-4 border-indigo-600" : "border-l-4 border-transparent hover:bg-slate-50"
                                )}
                              >
                                <div className={cn(
                                  "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                                  progress[lesson.id] 
                                    ? "bg-emerald-100 text-emerald-600" 
                                    : lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover/item:bg-slate-200"
                                )}>
                                  {progress[lesson.id] ? <CheckCircle className="w-4 h-4" /> : <Play className="w-3 h-3" />}
                                </div>
                                <span className={cn("text-xs font-bold truncate", lessonSlug === (lesson.slug || lesson.id) ? "text-indigo-900" : "text-slate-700")}>{lesson.title}</span>
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  {/* Sub Course Modules */}
                  {subCourses.map((sc) => (
                    <div key={sc.id}>
                      <div className="p-4 bg-indigo-50/50 border-y border-indigo-100">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-1">
                          <Layers className="w-3 h-3" />
                          Sub Course
                        </div>
                        <div className="text-sm font-black text-slate-900">{sc.title}</div>
                      </div>
                      {sc.modules.map((module: any, mIdx: number) => (
                        <div key={module.id} className="group">
                          <button 
                            onClick={() => setActiveModuleId(activeModuleId === module.id ? null : module.id)}
                            className={cn(
                              "w-full p-4 flex items-center justify-between text-left transition-all",
                              activeModuleId === module.id ? "bg-slate-50" : "hover:bg-slate-50/50"
                            )}
                          >
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit {mIdx + 1}</div>
                                <div className="text-sm font-bold text-slate-900 truncate">{module.title}</div>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", activeModuleId === module.id ? "rotate-180" : "")} />
                          </button>
                          <AnimatePresence>
                            {activeModuleId === module.id && (
                              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-white overflow-hidden divide-y divide-slate-50">
                                {module.lessons.map((lesson: any) => (
                                  <Link
                                    key={lesson.id}
                                    to={getLessonPath(sc, module, lesson)}
                                    className={cn(
                                      "w-full p-4 flex items-center gap-3 text-left transition-all group/item",
                                      lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-50 border-l-4 border-indigo-600" : "border-l-4 border-transparent hover:bg-slate-50"
                                    )}
                                  >
                                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all", progress[lesson.id] ? "bg-emerald-100 text-emerald-600" : lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}>
                                      {progress[lesson.id] ? <CheckCircle className="w-4 h-4" /> : <Play className="w-3 h-3" />}
                                    </div>
                                    <span className={cn("text-xs font-bold truncate", lessonSlug === (lesson.slug || lesson.id) ? "text-indigo-900" : "text-slate-700")}>{lesson.title}</span>
                                  </Link>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <CourseLeaderboard courseId={course?.id} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6 lg:space-y-8">
          {(selectedLesson || selectedModule || selectedSubCourse || viewLevel === 'course') ? (
            <>
              <div className="bg-white p-6 lg:p-10 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                {((selectedLesson?.img_url) || (selectedModule?.img_url) || (selectedSubCourse?.img_url) || course?.img_url) && (
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <img 
                      src={selectedLesson?.img_url || selectedModule?.img_url || selectedSubCourse?.img_url || course?.img_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6 relative">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                      {viewLevel.toUpperCase()} VIEW
                    </span>
                    {(selectedLesson && progress[selectedLesson.id]) && (
                      <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                        <CheckCircle className="w-3 h-3" />
                        Mastered
                      </span>
                    )}
                  </div>
                </div>
                
                <h1 className="text-2xl lg:text-4xl font-black text-slate-900 leading-tight">
                  {selectedLesson?.title || selectedModule?.title || selectedSubCourse?.title || course?.title}
                </h1>

                <div className="flex items-center gap-1 mt-8 p-1 bg-slate-50 rounded-2xl w-fit overflow-x-auto no-scrollbar">
                  {[
                    { id: 'content', label: viewLevel === 'lesson' ? 'Lesson' : 'Learning Content', icon: Book },
                    ...(viewLevel === 'lesson' ? [{ id: 'quiz', label: 'Practice', icon: HelpCircle }] : []),
                    ...(viewLevel === 'lesson' ? [{ id: 'notes', label: 'Notes', icon: FileText }] : []),
                    ...(isAdmin && viewLevel === 'lesson' ? [{ id: 'manage', label: 'Admin', icon: SettingsIcon }] : [])
                  ].map((tab: any) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-[50vh]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selectedLesson?.id || selectedModule?.id || selectedSubCourse?.id || course?.id}-${activeTab}`}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'content' && (
                      <LearningContent 
                        targetId={selectedLesson?.id || selectedModule?.id || selectedSubCourse?.id || course?.id || ''} 
                        targetType={viewLevel}
                        unitIndex={selectedModule ? allModules.indexOf(selectedModule) : undefined}
                        lessonIndex={selectedLesson && selectedModule ? selectedModule.lessons.findIndex(l => l.id === selectedLesson.id) : undefined}
                        isCompleted={selectedLesson ? !!progress[selectedLesson.id] : false}
                        onComplete={(score) => selectedLesson && toggleLessonCompletion(selectedLesson.id, score)}
                        permissions={permissions}
                        courseId={course?.id}
                      />
                    )}

                    {viewLevel === 'lesson' && activeTab === 'quiz' && selectedLesson && <QuizViewer targetId={selectedLesson.id} targetType="lesson" />}
                    {viewLevel === 'lesson' && activeTab === 'notes' && selectedLesson && <NoteSection targetId={selectedLesson.id} targetType="lesson" />}
                    {viewLevel === 'lesson' && activeTab === 'manage' && isAdmin && selectedLesson && (
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
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Footer */}
              {viewLevel === 'lesson' && (
                <div className="flex items-center justify-between py-8 border-t-2 border-slate-100 mt-20">
                  <button
                    onClick={() => {
                      const idx = allLessons.findIndex(l => l.id === selectedLesson.id);
                      if (idx > 0) {
                         const prevLesson = allLessons[idx - 1];
                         const prevModule = allModules.find(m => m.lessons.some((l: any) => l.id === prevLesson.id));
                         const prevSubCourse = subCourses.find(sc => sc.modules.some((m: any) => m.id === prevModule?.id));
                         navigate(getLessonPath(prevSubCourse, prevModule, prevLesson));
                      }
                    }}
                    disabled={allLessons.findIndex(l => l.id === selectedLesson?.id) === 0}
                    className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-500 hover:text-indigo-600 font-bold disabled:opacity-30 transition-all group"
                  >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="hidden sm:inline">Previous Lesson</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!user || !selectedLesson || !activeTenant) return;
                      const nextId = await adaptiveEngine.getNextLesson(user.id, selectedLesson.id, activeTenant.id);
                      if (nextId) {
                         const nl = allLessons.find(l => l.id === nextId);
                         const nm = allModules.find(m => m.lessons.some((l: any) => l.id === nextId));
                         const nsc = subCourses.find(sc => sc.modules.some((m: any) => m.id === nm?.id));
                         navigate(getLessonPath(nsc, nm, nl));
                         setActiveTab('content');
                      } else {
                        const idx = allLessons.findIndex(l => l.id === selectedLesson.id);
                        if (idx < allLessons.length - 1) {
                           const nl = allLessons[idx + 1];
                           const nm = allModules.find(m => m.lessons.some((l: any) => l.id === nl.id));
                           const nsc = subCourses.find(sc => sc.modules.some((m: any) => m.id === nm?.id));
                           navigate(getLessonPath(nsc, nm, nl));
                           setActiveTab('content');
                        }
                      }
                    }}
                    disabled={allLessons.findIndex(l => l.id === selectedLesson?.id) === allLessons.length - 1}
                    className="flex items-center gap-3 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-30 transition-all shadow-xl shadow-slate-200 group"
                  >
                    <span className="hidden sm:inline">Next Lesson</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </>
          ) : (
             <div className="bg-white p-20 rounded-3xl border border-slate-200 shadow-sm text-center">
                <Book className="w-16 h-16 text-slate-200 mx-auto mb-8" />
                <h3 className="text-2xl font-black text-slate-900">Select a lesson to begin</h3>
                <button onClick={() => setIsSidebarOpen(true)} className="mt-8 lg:hidden bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">Open Sidebar</button>
             </div>
          )}
        </div>
      </div>
      
      {/* Edit Modal (Keeping for Admin functionality, but simplified for clarity) */}
      <AnimatePresence>
        {isEditModalOpen && editTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
             <div className="relative w-full max-w-lg bg-white rounded-2xl p-8">
                <div className="flex justify-between mb-4">
                   <h3 className="text-xl font-bold">Edit {editTarget.type}</h3>
                   <X className="cursor-pointer" onClick={() => setIsEditModalOpen(false)} />
                </div>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                   <input type="text" value={editTarget.data.title} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, title: e.target.value}})} className="w-full p-2 border rounded" />
                   <button type="submit" disabled={savingEdit} className="w-full bg-indigo-600 text-white p-2 rounded">Save</button>
                </form>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

