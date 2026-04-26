import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
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
  Layers,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { LearningContent } from './LearningContent';
import { CourseLeaderboard } from './CourseLeaderboard';
import { GRADES, SUBJECTS } from '../constants';
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
  const params = useParams();
  const courseSlug = params.courseSlug;
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/my-courses') ? '/my-courses' : '/courses';
  
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
  const [courseActiveTab, setCourseActiveTab] = useState<'syllabus' | 'leaderboard'>('syllabus');
  const [prerequisitesMet, setPrerequisitesMet] = useState(true);
  const [missingPrereqTitles, setMissingPrereqTitles] = useState<string[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSubCourseId, setActiveSubCourseId] = useState<string | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{type: 'course' | 'subcourse' | 'unit' | 'lesson', data: any} | null>(null);
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

  const splat = params["*"] || "";
  const parts = splat.split('/').filter(Boolean);
  
  let matchedSubCourse: any = null;
  let matchedModule: any = null;
  let matchedLesson: any = null;

  if (parts.length > 0) {
    matchedSubCourse = subCourses.find(sc => sc.slug === parts[0] || sc.id === parts[0]);
    if (matchedSubCourse) {
      if (parts.length > 1) {
        matchedModule = matchedSubCourse.modules.find((m: any) => m.slug === parts[1] || m.id === parts[1]);
      }
      if (matchedModule && parts.length > 2) {
        matchedLesson = matchedModule.lessons.find((l: any) => l.slug === parts[2] || l.id === parts[2]);
      }
    } else {
      matchedModule = directModules.find(m => m.slug === parts[0] || m.id === parts[0]);
      if (matchedModule && parts.length > 1) {
        matchedLesson = matchedModule.lessons.find((l: any) => l.slug === parts[1] || l.id === parts[1]);
      }
    }
  }

  const selectedSubCourse = matchedSubCourse;
  const selectedModule = matchedModule;
  const selectedLesson = matchedLesson;

  const subCourseSlug = selectedSubCourse ? (selectedSubCourse.slug || selectedSubCourse.id) : undefined;
  const unitSlug = selectedModule ? (selectedModule.slug || selectedModule.id) : undefined;
  const lessonSlug = selectedLesson ? (selectedLesson.slug || selectedLesson.id) : undefined;

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
      if (editTarget.type === 'course') endpoint = `/api/courses/${editTarget.data.id}`;
      else if (editTarget.type === 'subcourse') endpoint = `/api/sub-courses/${editTarget.data.id}`;
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

  const getSubCoursePath = (sc: any) => `${basePath}/${courseSlug}/${sc.slug || sc.id}`;
  const getUnitPath = (sc: any, m: any) => sc 
    ? `${basePath}/${courseSlug}/${sc.slug || sc.id}/${m.slug || m.id}`
    : `${basePath}/${courseSlug}/${m.slug || m.id}`;
  const getLessonPath = (sc: any, m: any, l: any) => sc
    ? `${basePath}/${courseSlug}/${sc.slug || sc.id}/${m.slug || m.id}/${l.slug || l.id}`
    : `${basePath}/${courseSlug}/${m.slug || m.id}/${l.slug || l.id}`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Learning Header - Immersive & Persistent */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 lg:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all shrink-0"
              title="Back to Dashboard"
            >
              <ChevronLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div className="flex flex-col truncate">
              <h1 className="text-sm lg:text-lg font-black text-slate-900 truncate">
                {selectedLesson?.title || selectedModule?.title || course?.title}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                  {course?.title}
                </span>
                {selectedLesson && (
                  <>
                    <span className="text-[10px] text-slate-300">•</span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${(Object.values(progress).filter(Boolean).length / (allLessons.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => {
                  setEditTarget({ type: 'course', data: course });
                  setIsEditModalOpen(true);
                }}
                className="hidden sm:flex p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <SettingsIcon className="w-5 h-5 text-slate-400" />
              </button>
            )}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-all"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Outline</span>
              <span className="flex items-center justify-center bg-indigo-600 text-white text-[9px] w-4 h-4 rounded-full sm:hidden">
                {allModules.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden lg:max-w-screen-2xl lg:mx-auto lg:w-full">
        {/* Desktop Sidebar - Static for large screens, Drawer for small */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-full sm:w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 flex flex-col shadow-2xl lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="p-4 lg:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <h2 className="font-black text-xl text-slate-900">Course Outline</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-50 rounded-xl">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
            {/* Subcourses horizontal scroll selector inside sidebar for context */}
            {subCourses.length > 0 && (
              <div className="px-2 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Knowledge Paths</span>
                <div className="flex flex-col gap-1">
                  {subCourses.map(sc => (
                    <Link
                      key={sc.id}
                      to={getSubCoursePath(sc)}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3",
                        activeSubCourseId === sc.id 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                          : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <Layers className="w-4 h-4" />
                      {sc.title}
                    </Link>
                  ))}
                  {directModules.length > 0 && (
                     <Link
                      to={`${basePath}/${courseSlug}`}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3",
                        !activeSubCourseId ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <Book className="w-4 h-4" />
                      Main Modules
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              {(activeSubCourseId ? subCourses.find(sc => sc.id === activeSubCourseId)?.modules : directModules)?.map((module: any, mIdx: number) => (
                <div key={module.id} className="group">
                  <button 
                    onClick={() => setActiveModuleId(activeModuleId === module.id ? null : module.id)}
                    className={cn(
                      "w-full p-3 flex items-center justify-between text-left transition-all rounded-xl mx-2 w-[calc(100%-16px)]",
                      activeModuleId === module.id ? "bg-slate-900 text-white shadow-md" : "hover:bg-slate-100 text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                        activeModuleId === module.id ? "bg-indigo-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {mIdx + 1}
                      </div>
                      <span className="text-sm font-bold truncate">{module.title}</span>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", activeModuleId === module.id ? "rotate-180" : "opacity-30")} />
                  </button>
                  <AnimatePresence>
                    {activeModuleId === module.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-1 px-4">
                        <div className="py-1 space-y-0.5 border-l-2 border-slate-100 ml-5">
                          {module.lessons.map((lesson: any) => (
                            <Link
                              key={lesson.id}
                              to={getLessonPath(activeSubCourseId ? subCourses.find(sc => sc.id === activeSubCourseId) : null, module, lesson)}
                              onClick={() => setIsSidebarOpen(false)}
                              className={cn(
                                "w-full p-2.5 flex items-center gap-3 text-left transition-all rounded-r-xl group/item relative",
                                lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              )}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0 transition-all",
                                progress[lesson.id] 
                                  ? "bg-emerald-500" 
                                  : lessonSlug === (lesson.slug || lesson.id) ? "bg-indigo-600 ring-4 ring-indigo-100" : "bg-slate-200 group-hover/item:bg-slate-400"
                              )} />
                              <span className="text-xs font-semibold truncate leading-tight">{lesson.title}</span>
                              {progress[lesson.id] && <CheckCircle className="w-3 h-3 text-emerald-500 absolute right-2" />}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-4 py-6 md:px-8 md:py-12 space-y-8">
            {(selectedLesson || selectedModule || selectedSubCourse || viewLevel === 'course') ? (
              <>
                {viewLevel === 'course' && (
                  <div className="bg-slate-900 rounded-3xl p-8 lg:p-12 text-white relative overflow-hidden shadow-2xl mb-12">
                    {course?.img_url && (
                      <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <img src={course.img_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-2">
                        <Book className="w-6 h-6 text-indigo-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Main Course</span>
                      </div>
                      <h2 className="text-3xl lg:text-5xl font-black">{course?.title}</h2>
                      <p className="text-slate-300 max-w-2xl text-lg leading-relaxed">{course?.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-4 pt-4">
                        <button 
                          onClick={() => {
                            const firstLesson = allLessons[0];
                            if (firstLesson) {
                              const module = allModules.find(m => m.lessons.some((l: any) => l.id === firstLesson.id));
                              const sc = subCourses.find(sc => sc.modules.some((m: any) => m.id === module?.id));
                              navigate(getLessonPath(sc, module, firstLesson));
                            }
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-900/40 flex items-center gap-2"
                        >
                          <Play className="w-5 h-5 fill-current" />
                          Start Learning
                        </button>
                        <div className="flex items-center gap-6 text-sm font-bold text-slate-400 px-4">
                           <div className="flex flex-col">
                             <span className="text-white text-xl">{allLessons.length}</span>
                             <span>Lessons</span>
                           </div>
                           <div className="w-px h-8 bg-slate-800" />
                           <div className="flex flex-col">
                             <span className="text-white text-xl">{Math.round((Object.values(progress).filter(Boolean).length / (allLessons.length || 1)) * 100)}%</span>
                             <span>Progress</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {viewLevel === 'course' && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-100 rounded-2xl w-fit">
                      {[
                        { id: 'syllabus', label: 'Curriculum', icon: Book },
                        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }
                      ].map((tab: any) => (
                        <button
                          key={tab.id}
                          onClick={() => setCourseActiveTab(tab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            courseActiveTab === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {courseActiveTab === 'syllabus' ? (
                        <motion.div 
                          key="syllabus"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-12"
                        >
                          {/* Sub-courses Collection */}
                          {subCourses.length > 0 && (
                            <section className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black text-slate-900">Learning Paths</h3>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{subCourses.length} Segments</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {subCourses.map((sc) => {
                                  const totalLessons = sc.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0);
                                  const completedLessons = sc.modules.reduce((acc: number, m: any) => acc + m.lessons.filter((l: any) => progress[l.id]).length, 0);
                                  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
                                  
                                  return (
                                    <Link 
                                      key={sc.id} 
                                      to={getSubCoursePath(sc)}
                                      className="group bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-indigo-200 transition-all shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 flex flex-col gap-6"
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                          <Layers className="w-8 h-8" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Unit</span>
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{sc.title}</h4>
                                        <p className="text-sm text-slate-500 line-clamp-2">{sc.metadata?.description || `Explore ${sc.title} and master the core concepts.`}</p>
                                      </div>

                                      <div className="mt-auto space-y-4">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                          <span className="text-slate-400 uppercase tracking-widest">{totalLessons} Lessons</span>
                                          <span className="text-indigo-600">{progressPercent}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                          <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progressPercent}%` }}
                                            className="h-full bg-indigo-600 rounded-full"
                                          />
                                        </div>
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            </section>
                          )}

                          {/* Direct Modules (if any) */}
                          {directModules.length > 0 && (
                            <section className="space-y-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-black text-slate-900">Modules</h3>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{directModules.length} Modules</span>
                              </div>
                              <div className="grid gap-4">
                                {directModules.map((module, mIdx) => (
                                  <div key={module.id} className="bg-slate-50 rounded-3xl p-6 border border-slate-100 hover:border-indigo-200 transition-all group">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:scale-110 transition-transform">
                                          {mIdx + 1}
                                        </div>
                                        <div className="space-y-1">
                                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{module.title}</h4>
                                          <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium text-slate-500">{module.lessons.length} Lessons</span>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-xs font-bold text-indigo-600">
                                              {Math.round((module.lessons.filter((l: any) => progress[l.id]).length / (module.lessons.length || 1)) * 100)}% Complete
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => {
                                          setActiveModuleId(module.id);
                                          const firstLesson = module.lessons[0];
                                          if (firstLesson) navigate(getLessonPath(null, module, firstLesson));
                                        }}
                                        className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-slate-400 hover:text-indigo-600"
                                      >
                                        <ChevronRight className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="leaderboard"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <CourseLeaderboard courseId={course?.id} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {viewLevel !== 'course' && (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">
                          {viewLevel}
                        </span>
                        {selectedLesson && progress[selectedLesson.id] && (
                          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                            <CheckCircle className="w-3 h-3" /> Completed
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl lg:text-4xl font-black text-slate-900">
                        {selectedLesson?.title || selectedModule?.title || selectedSubCourse?.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-100 rounded-2xl w-fit mb-8">
                       {[
                        { id: 'content', label: 'Lesson', icon: Book },
                        ...(viewLevel === 'lesson' ? [{ id: 'quiz', label: 'Practice', icon: HelpCircle }] : []),
                        ...(viewLevel === 'lesson' ? [{ id: 'notes', label: 'Notes', icon: FileText }] : []),
                        ...(isAdmin && viewLevel === 'lesson' ? [{ id: 'manage', label: 'Settings', icon: SettingsIcon }] : [])
                      ].map((tab: any) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                          )}
                        >
                          <tab.icon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${selectedLesson?.id || selectedModule?.id || selectedSubCourse?.id || course?.id}-${activeTab}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
                        className="markdown-container"
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

                        {viewLevel === 'subcourse' && activeTab === 'content' && selectedSubCourse?.modules?.length > 0 && (
                          <div className="mt-12 space-y-6 pt-8 border-t-2 border-slate-100">
                            <h3 className="text-2xl font-black text-slate-900">Modules in this Path</h3>
                            <div className="grid gap-4">
                              {selectedSubCourse.modules.map((module: any, mIdx: number) => (
                                <div key={module.id} className="bg-slate-50 rounded-3xl p-6 border border-slate-100 hover:border-indigo-200 transition-all group">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-4">
                                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:scale-110 transition-transform">
                                        {mIdx + 1}
                                      </div>
                                      <div className="space-y-1">
                                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{module.title}</h4>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs font-medium text-slate-500">{module.lessons?.length || 0} Lessons</span>
                                          {module.lessons?.length > 0 && (
                                            <>
                                              <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                              <span className="text-xs font-bold text-indigo-600">
                                                {Math.round((module.lessons.filter((l: any) => progress[l.id]).length / module.lessons.length) * 100)}% Complete
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        setActiveModuleId(module.id);
                                        const firstLesson = module.lessons?.[0];
                                        if (firstLesson) navigate(getLessonPath(selectedSubCourse, module, firstLesson));
                                      }}
                                      className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-slate-400 hover:text-indigo-600"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {viewLevel === 'unit' && activeTab === 'content' && selectedModule?.lessons?.length > 0 && (
                          <div className="mt-12 space-y-6 pt-8 border-t-2 border-slate-100">
                            <h3 className="text-2xl font-black text-slate-900">Lessons in this Module</h3>
                            <div className="grid gap-4">
                              {selectedModule.lessons.map((lesson: any, lIdx: number) => (
                                <Link 
                                  key={lesson.id}
                                  to={getLessonPath(selectedSubCourse, selectedModule, lesson)}
                                  className="bg-slate-50 rounded-3xl p-6 border border-slate-100 hover:border-indigo-200 transition-all group flex items-start justify-between gap-4"
                                >
                                  <div className="flex gap-4">
                                    <div className={cn(
                                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-sm transition-transform group-hover:scale-110",
                                      progress[lesson.id] ? "bg-emerald-100 text-emerald-600" : "bg-white text-indigo-600"
                                    )}>
                                      {progress[lesson.id] ? <CheckCircle className="w-6 h-6" /> : lIdx + 1}
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{lesson.title}</h4>
                                    </div>
                                  </div>
                                  <div className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-slate-400 hover:text-indigo-600">
                                    <ChevronRight className="w-5 h-5" />
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {viewLevel === 'lesson' && activeTab === 'quiz' && selectedLesson && <QuizViewer targetId={selectedLesson.id} targetType="lesson" />}
                        {viewLevel === 'lesson' && activeTab === 'notes' && selectedLesson && <NoteSection targetId={selectedLesson.id} targetType="lesson" />}
                        {viewLevel === 'lesson' && activeTab === 'manage' && isAdmin && selectedLesson && (
                          <div className="space-y-8">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                              <h3 className="text-lg font-bold text-slate-900 mb-4">Adaptive Engine Settings</h3>
                              <LessonAdaptiveEditor lessonId={selectedLesson.id} tenantId={activeTenant?.id || ''} />
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                              <h3 className="text-lg font-bold text-slate-900 mb-4">Lesson Quiz Management</h3>
                              <QuizManager targetId={selectedLesson.id} targetType="lesson" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}

                {/* Sticky Mobile Nav Footer */}
                {viewLevel === 'lesson' && (
                  <div className="flex items-center justify-between py-6 md:py-12 border-t-2 border-slate-50 sticky bottom-0 bg-white ring-8 ring-white">
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
                      className="flex items-center gap-2 text-slate-400 hover:text-slate-900 disabled:opacity-20 font-bold transition-all p-4 -ml-4"
                    >
                      <ChevronLeft className="w-6 h-6" />
                      <span className="text-sm">Back</span>
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
                      className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-slate-900 disabled:opacity-20 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </>
            ) : (
               <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto">
                    <Book className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Choose your starting point</h3>
                  <p className="text-slate-500 max-w-sm mx-auto">Select a unit from the course outline to begin your learning journey.</p>
                  <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold shadow-xl">
                    View Outline
                  </button>
               </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Edit Modal remains identical but visually polished later if needed */}
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
                   <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                     <input type="text" value={editTarget.data.title || ''} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, title: e.target.value}})} className="w-full p-2 border rounded border-slate-300" required />
                   </div>
                   {editTarget.type === 'course' && (
                     <>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                         <textarea value={editTarget.data.description || ''} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, description: e.target.value}})} className="w-full p-2 border rounded border-slate-300" rows={3} />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                         <input type="url" value={editTarget.data.img_url || ''} onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, img_url: e.target.value}})} className="w-full p-2 border rounded border-slate-300" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                            <select
                              value={editTarget.data.grade || ''}
                              onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, grade: e.target.value}})}
                              className="w-full p-2 border rounded border-slate-300"
                            >
                              <option value="">Select Grade</option>
                              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                            <select
                              value={editTarget.data.subject || ''}
                              onChange={e => setEditTarget({...editTarget, data: {...editTarget.data, subject: e.target.value}})}
                              className="w-full p-2 border rounded border-slate-300"
                            >
                              <option value="">Select Subject</option>
                              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                     </>
                   )}
                   <button type="submit" disabled={savingEdit} className="w-full bg-indigo-600 font-bold hover:bg-indigo-700 transition-colors text-white p-3 rounded-xl disabled:opacity-50">
                     {savingEdit ? 'Saving...' : 'Save Changes'}
                   </button>
                </form>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

