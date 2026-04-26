import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import { Book, ChevronRight, Plus, Search, X, Loader2, GraduationCap, CheckCircle, Zap, Lock, Sparkles, AlertCircle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CourseViewer } from './CourseViewer';
import { AICourseGenerator } from './AICourseGenerator';
import { GRADES, SUBJECTS } from '../constants';

export const CourseList: React.FC<{ onlyEnrolled?: boolean }> = ({ onlyEnrolled = false }) => {
  const { activeTenant, user, memberships, enrollments, setEnrollments } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIGenModalOpen, setIsAIGenModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState<{title: string, description: string, img_url: string, slug: string, prerequisites: string[], grade: string, subject: string}>({ title: '', description: '', img_url: '', slug: '', prerequisites: [], grade: '', subject: '' });
  const [creating, setCreating] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [generatingDemo, setGeneratingDemo] = useState(false);
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);
  const [courseTitles, setCourseTitles] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdminOrTeacher = ['super_admin', 'school_admin', 'teacher'].includes(myRole || '');

  useEffect(() => {
    if (activeTenant) {
      fetchCourses();
      fetchCompletedCourses();
      fetchCourseTitles();
    }
  }, [activeTenant, user, onlyEnrolled, enrollments]);

  const fetchCourseTitles = async () => {
    if (!activeTenant) return;
    try {
      const { data } = await supabase
        .from('courses')
        .select('id, title')
        .eq('tenant_id', activeTenant.id);
      
      if (data) {
        const titleMap = data.reduce((acc: any, c: any) => {
          acc[c.id] = c.title;
          return acc;
        }, {});
        setCourseTitles(titleMap);
      }
    } catch (err) {
      console.error('Error fetching course titles:', err);
    }
  };

  const fetchCompletedCourses = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('learning_events')
        .select('course_id')
        .eq('user_id', user.id)
        .eq('event_type', 'course_completed');
      
      if (data) {
        setCompletedCourses(data.map(d => d.course_id).filter(Boolean));
      }
    } catch (err) {
      console.error('Error fetching completed courses:', err);
    }
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      if (onlyEnrolled && user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session');

        const tenantParam = activeTenant?.id ? `?tenantId=${activeTenant.id}` : '';
        const response = await fetch(`/api/my-courses${tenantParam}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        // Check for 5xx or 4xx responses without throwing native generic errors immediately
        if (!response.ok) {
           let errorMsg = `Server returned ${response.status}`;
           try {
              const errData = await response.json();
              if (errData && errData.error) errorMsg = errData.error;
           } catch (e) {
              // Could not parse JSON error response
           }
           throw new Error(errorMsg);
        }

        const data = await response.json();
        if (data.success) {
          setCourses(data.courses);
        } else {
          throw new Error(data.error || 'Failed to fetch enrolled courses');
        }
      } else {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('tenant_id', activeTenant?.id || null) // use explicit null instead of undefined
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) setCourses(data);
      }
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      // Give the user a more helpful generic state if it's a "Failed to fetch" network error
      if (err.message === 'Failed to fetch') {
         console.warn("A network error occurred. Check your AdBlocker, internet connection, or Supabase credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: newCourse.title,
          description: newCourse.description,
          img_url: newCourse.img_url,
          slug: newCourse.slug,
          tenantId: activeTenant.id,
          prerequisites: newCourse.prerequisites,
          grade: newCourse.grade,
          subject: newCourse.subject
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create course');
      }

      setCourses([data.course, ...courses]);
      setIsModalOpen(false);
      setNewCourse({ title: '', description: '', img_url: '', slug: '', prerequisites: [], grade: '', subject: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user || !activeTenant) return;
    setEnrolling(courseId);

    // Determine the role to enroll as. 
    // The database only accepts 'student' or 'teacher' in the enrollments table currently.
    const enrollRole = (myRole === 'teacher') ? 'teacher' : 'student';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          courseId,
          tenantId: activeTenant.id,
          role: enrollRole
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enroll');
      }

      setEnrollments(prev => ({ ...prev, [courseId]: true }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEnrolling(null);
    }
  };

  const handleGenerateDemo = async () => {
    if (!activeTenant || !user) return;
    setGeneratingDemo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId: activeTenant.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate demo');
      }

      // Refresh courses
      fetchCourses();
      alert('Demo course generated successfully! Enroll and complete the lesson to test gamification.');
    } catch (err: any) {
      console.error('Error generating demo:', err);
      alert('Failed to generate demo: ' + err.message);
    } finally {
      setGeneratingDemo(false);
    }
  };

  const arePrerequisitesMet = (course: any) => {
    if (isAdminOrTeacher) return true;
    if (!course.prerequisites || course.prerequisites.length === 0) return true;
    return course.prerequisites.every((prereqId: string) => completedCourses.includes(prereqId));
  };

  const getMissingPrerequisites = (course: any) => {
    if (!course.prerequisites) return [];
    return course.prerequisites.filter((id: string) => !completedCourses.includes(id));
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = filterGrade === 'all' || course.grade === filterGrade;
    const matchesSubject = filterSubject === 'all' || course.subject === filterSubject;
    return matchesSearch && matchesGrade && matchesSubject;
  });

  return (
    <div className="space-y-6">
      <Routes>
        <Route path="/" element={
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-slate-900">
                {onlyEnrolled ? 'My Courses' : 'All Courses'}
              </h2>
              {isAdminOrTeacher && !onlyEnrolled && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAIGenModalOpen(true)}
                    className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-purple-200 transition-all shadow-sm"
                  >
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI Architect
                  </button>
                  <button 
                    onClick={handleGenerateDemo}
                    disabled={generatingDemo}
                    className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-emerald-200 transition-all disabled:opacity-50"
                  >
                    {generatingDemo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    Generate Demo
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <Plus className="w-5 h-5" />
                    Create Course
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search courses by title or description..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none text-slate-900"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="all">All Grades</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={filterSubject}
                    onChange={(e) => setFilterSubject(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-sm font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="all">All Subjects</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>
              </div>
              {(filterGrade !== 'all' || filterSubject !== 'all' || searchQuery) && (
                <button 
                  onClick={() => {
                    setFilterGrade('all');
                    setFilterSubject('all');
                    setSearchQuery('');
                  }}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  title="Clear filters"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => {
                  const isLocked = !arePrerequisitesMet(course);
                  const missingPrereqs = getMissingPrerequisites(course);
                  
                  return (
                    <motion.div
                      key={course.id}
                      whileHover={!isLocked ? { y: -8, transition: { duration: 0.3 } } : {}}
                      className={cn(
                        "bg-white rounded-[2rem] border border-slate-200 overflow-hidden transition-all flex flex-col h-full",
                        isLocked ? "opacity-75 grayscale-[0.5]" : "shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 group"
                      )}
                    >
                      <div 
                        className="h-44 bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50/50 transition-all relative shrink-0 cursor-pointer overflow-hidden"
                        onClick={() => !isLocked && navigate(`/courses/${course.slug || course.id}`)}
                      >
                        {course.img_url ? (
                          <img 
                            src={course.img_url} 
                            alt={course.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                             <Book className={cn("w-14 h-14 transition-colors duration-300", isLocked ? "text-slate-200" : "text-slate-300 group-hover:text-indigo-400")} />
                          </div>
                        )}
                        
                        {/* Overlay for locked courses */}
                        {isLocked && (
                          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="bg-white/90 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2">
                              <Lock className="w-4 h-4 text-slate-700" />
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Locked</span>
                            </div>
                          </div>
                        )}

                        {/* Subject Badge */}
                        {!isLocked && course.subject && (
                          <div className="absolute top-4 left-4">
                            <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold text-indigo-600 shadow-sm border border-indigo-100/50 uppercase tracking-widest">
                              {course.subject}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-8 flex flex-col flex-grow">
                        <div className="flex-grow">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h3 
                              className="font-bold text-slate-900 text-xl leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
                              onClick={() => !isLocked && navigate(`/courses/${course.slug || course.id}`)}
                            >
                              {course.title}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-4">
                            {course.grade && (
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <GraduationCap className="w-4 h-4" />
                                <span className="text-sm font-medium">{course.grade}</span>
                              </div>
                            )}
                          </div>

                          <p className="text-slate-600 text-sm line-clamp-3 mb-6 leading-relaxed">
                            {course.description || "No description provided for this course. Start learning to discover the content."}
                          </p>

                          {isLocked && missingPrereqs.length > 0 && (
                            <div className="mb-6 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                Prerequisites Required:
                              </p>
                              <div className="space-y-1.5">
                                {missingPrereqs.map((id: string) => (
                                  <div key={id} className="flex items-center gap-2 text-amber-700/70 text-xs">
                                    <div className="w-1 h-1 rounded-full bg-amber-300" />
                                    <span className="truncate italic">{courseTitles[id] || 'Required Course'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                          {enrollments[course.id] ? (
                            <button 
                              onClick={() => !isLocked && navigate(`/courses/${course.slug || course.id}`)}
                              disabled={isLocked}
                              className={cn(
                                "flex items-center gap-2 font-bold text-sm transition-all py-2 pr-4 rounded-xl",
                                isLocked ? "text-slate-400 cursor-not-allowed" : "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50"
                              )}
                            >
                              <Play className="w-4 h-4 fill-current" />
                              Continue Learning
                            </button>
                          ) : (
                            <button 
                              onClick={() => !isLocked && handleEnroll(course.id)}
                              disabled={enrolling === course.id || isLocked}
                              className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2",
                                isLocked 
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200/50 disabled:opacity-50"
                              )}
                            >
                              {enrolling === course.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Enroll Now
                                </>
                              )}
                            </button>
                          )}
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                            isLocked ? "bg-slate-50 text-slate-200" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white"
                          )}>
                             <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900">
                  {onlyEnrolled ? "You're not enrolled in any courses" : "No courses yet"}
                </h3>
                <p className="text-slate-500 mt-2">
                  {onlyEnrolled ? "Browse all courses to find something to learn." : "Get started by creating your first course."}
                </p>
              </div>
            )}
          </>
        } />
        
        <Route path="/:courseSlug/*" element={
          <CourseViewer onBack={() => navigate(onlyEnrolled ? '/my-courses' : '/courses')} />
        } />
      </Routes>

      {/* Create Course Modal */}
      <AnimatePresence>
        {isAIGenModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAIGenModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 border border-slate-200"
            >
              <button 
                onClick={() => setIsAIGenModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <AICourseGenerator 
                onSuccess={() => fetchCourses()} 
                onClose={() => setIsAIGenModalOpen(false)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Course Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Create New Course</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    value={newCourse.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                      setNewCourse({ ...newCourse, title, slug });
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Introduction to Physics"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Course Slug</label>
                    <input
                      type="text"
                      required
                      value={newCourse.slug}
                      onChange={(e) => setNewCourse({ ...newCourse, slug: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="intro-to-physics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={newCourse.img_url}
                      onChange={(e) => setNewCourse({ ...newCourse, img_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="https://images.com/course.jpg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                    <select
                      value={newCourse.grade}
                      onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="">Select Grade</option>
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <select
                      value={newCourse.subject}
                      onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="">Select Subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={4}
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Describe what students will learn..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prerequisites (Optional)</label>
                  <select
                    multiple
                    value={newCourse.prerequisites}
                    onChange={(e) => {
                      const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                      setNewCourse({ ...newCourse, prerequisites: selectedOptions });
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px]"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple courses.</p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Course'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
