import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Book, ChevronRight, Plus, Search, X, Loader2, GraduationCap, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CourseViewer } from './CourseViewer';

export const CourseList: React.FC = () => {
  const { activeTenant, user, memberships } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdminOrTeacher = ['school_admin', 'teacher'].includes(myRole || '');

  useEffect(() => {
    if (activeTenant) {
      fetchCourses();
      if (user) fetchEnrollments();
    }
  }, [activeTenant, user]);

  const fetchCourses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('tenant_id', activeTenant?.id)
      .order('created_at', { ascending: false });
    
    if (data) setCourses(data);
    setLoading(false);
  };

  const fetchEnrollments = async () => {
    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user?.id)
      .eq('tenant_id', activeTenant?.id);
    
    if (data) {
      const enrollMap: Record<string, boolean> = {};
      data.forEach(e => enrollMap[e.course_id] = true);
      setEnrollments(enrollMap);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    
    setCreating(true);
    const { data, error } = await supabase
      .from('courses')
      .insert([
        { 
          title: newCourse.title, 
          description: newCourse.description, 
          tenant_id: activeTenant.id 
        }
      ])
      .select();

    if (!error && data) {
      setCourses([data[0], ...courses]);
      setIsModalOpen(false);
      setNewCourse({ title: '', description: '' });
    } else {
      alert(error?.message || 'Error creating course');
    }
    setCreating(false);
  };

  const handleEnroll = async (courseId: string) => {
    if (!user || !activeTenant) return;
    setEnrolling(courseId);

    const { error } = await supabase
      .from('enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId,
        tenant_id: activeTenant.id,
        role: 'student'
      });

    if (!error) {
      setEnrollments(prev => ({ ...prev, [courseId]: true }));
    } else {
      alert(error.message);
    }
    setEnrolling(null);
  };

  if (selectedCourseId) {
    return <CourseViewer courseId={selectedCourseId} onBack={() => setSelectedCourseId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Courses</h2>
        {isAdminOrTeacher && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Create Course
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search courses..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <motion.div
              key={course.id}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group transition-all"
            >
              <div className="h-32 bg-slate-100 flex items-center justify-center group-hover:bg-indigo-50 transition-all">
                <Book className="w-12 h-12 text-slate-300 group-hover:text-indigo-400" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-slate-900 text-lg mb-2">{course.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{course.description}</p>
                <div className="flex items-center justify-between">
                  {enrollments[course.id] ? (
                    <button 
                      onClick={() => setSelectedCourseId(course.id)}
                      className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline"
                    >
                      <GraduationCap className="w-4 h-4" />
                      View Course
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrolling === course.id}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {enrolling === course.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enroll Now'}
                    </button>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No courses yet</h3>
          <p className="text-slate-500 mt-2">Get started by creating your first course.</p>
        </div>
      )}

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
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Introduction to Physics"
                  />
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
