import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Search, Loader2, ChevronRight, GraduationCap, BookOpen, CheckCircle, Plus, Edit2, Phone, MapPin, User, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Student {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string;
}

interface StudentProgress {
  student: Student;
  courses: {
    id: string;
    title: string;
    progress: number;
    completed_lessons: number;
    total_lessons: number;
  }[];
}

export const ParentDashboard: React.FC = () => {
  const { user, profile, activeTenant, refreshData } = useAuth();
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);
  
  // Modals state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  // Form states
  const [studentUsername, setStudentUsername] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Child Form
  const [newChild, setNewChild] = useState({
    username: '',
    password: '',
    fullName: '',
    grade: '',
    phone: '',
    whatsapp: '',
    city: '',
    schoolName: ''
  });
  const [addingChild, setAddingChild] = useState(false);

  // Edit Profile Form
  const [editProfile, setEditProfile] = useState({
    fullName: profile?.full_name || '',
    phone: profile?.phone || '',
    whatsapp: profile?.whatsapp || '',
    city: profile?.city || ''
  });
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user && activeTenant) {
      fetchLinkedStudents();
    }
  }, [user, activeTenant]);

  useEffect(() => {
    if (profile) {
      setEditProfile({
        fullName: profile.full_name || '',
        phone: profile.phone || '',
        whatsapp: profile.whatsapp || '',
        city: profile.city || ''
      });
    }
  }, [profile]);

  const fetchLinkedStudents = async () => {
    if (!user || !activeTenant || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // 1. Get linked student IDs
      const { data: links, error: linksError } = await supabase
        .from('parent_student')
        .select('student_id')
        .eq('parent_id', user.id)
        .eq('tenant_id', activeTenant.id);

      if (linksError) throw linksError;

      const studentIds = links?.map(l => l.student_id) || [];
      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // 2. Get student profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, username')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      // 3. Get progress for each student
      const studentData: StudentProgress[] = await Promise.all((profiles || []).map(async (p) => {
        try {
          // Get enrollments for this student
          const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('course_id, courses(id, title)')
            .eq('user_id', p.id)
            .eq('tenant_id', activeTenant.id);

          if (enrollError) throw enrollError;

          const coursesProgress = await Promise.all((enrollments || []).map(async (enroll: any) => {
            try {
              const course = Array.isArray(enroll.courses) ? enroll.courses[0] : enroll.courses;
              if (!course) return null;

              // Get modules for this course
              const { data: modules, error: modulesError } = await supabase
                .from('modules')
                .select('id')
                .eq('course_id', course.id);
              
              if (modulesError) throw modulesError;
              const moduleIds = modules?.map(m => m.id) || [];

              if (moduleIds.length === 0) {
                return {
                  id: course.id,
                  title: course.title,
                  progress: 0,
                  completed_lessons: 0,
                  total_lessons: 0
                };
              }

              // Get total lessons
              const { count: totalLessons, error: lessonsError } = await supabase
                .from('lessons')
                .select('id', { count: 'exact', head: true })
                .in('module_id', moduleIds);
              
              if (lessonsError) throw lessonsError;

              // Get lesson IDs for this course to filter progress
              const { data: lessons, error: lessonsListError } = await supabase
                .from('lessons')
                .select('id')
                .in('module_id', moduleIds);
              
              if (lessonsListError) throw lessonsListError;
              const lessonIds = lessons?.map(l => l.id) || [];

              let completedLessons = 0;
              if (lessonIds.length > 0) {
                const { count: completed, error: progressError } = await supabase
                  .from('progress')
                  .select('id', { count: 'exact', head: true })
                  .eq('user_id', p.id)
                  .eq('completed', true)
                  .in('lesson_id', lessonIds);
                
                if (progressError) throw progressError;
                completedLessons = completed || 0;
              }

              return {
                id: course.id,
                title: course.title,
                progress: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
                completed_lessons: completedLessons,
                total_lessons: totalLessons || 0
              };
            } catch (err) {
              console.error(`Error fetching course progress for student ${p.id}:`, err);
              return null;
            }
          }));

          return {
            student: p,
            courses: coursesProgress.filter((c): c is any => c !== null)
          };
        } catch (err) {
          console.error(`Error fetching data for student ${p.id}:`, err);
          return {
            student: p,
            courses: []
          };
        }
      }));

      setStudents(studentData);
    } catch (err: any) {
      console.error('Error in fetchLinkedStudents:', err);
      setError(err.message || 'An unexpected error occurred while fetching student data.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTenant || !studentUsername) return;

    setLinking(true);
    setError(null);

    try {
      // 1. Find student by username
      const { data: p, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', studentUsername)
        .single();

      if (profileError || !p) {
        throw new Error('Student not found. Please check the ID.');
      }

      // 2. Check if already linked
      const { data: existing, error: existingError } = await supabase
        .from('parent_student')
        .select('id')
        .eq('parent_id', user.id)
        .eq('student_id', p.id)
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();

      if (existing) {
        throw new Error('This student is already linked to your account.');
      }

      // 3. Create link
      const { error: linkError } = await supabase
        .from('parent_student')
        .insert({
          parent_id: user.id,
          student_id: p.id,
          tenant_id: activeTenant.id
        });

      if (linkError) throw linkError;

      setIsLinkModalOpen(false);
      setStudentUsername('');
      fetchLinkedStudents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTenant) return;

    setAddingChild(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newChild)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create student account');
      }

      setIsAddModalOpen(false);
      setNewChild({
        username: '', password: '', fullName: '', grade: '', phone: '', whatsapp: '', city: '', schoolName: ''
      });
      fetchLinkedStudents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingChild(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUpdatingProfile(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: editProfile.fullName,
          phone: editProfile.phone,
          whatsapp: editProfile.whatsapp,
          city: editProfile.city
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setIsEditProfileOpen(false);
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Children</h2>
          <p className="text-slate-500 text-sm">Monitor your children's learning progress and activities.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-100 text-sm font-medium animate-pulse">
              <XCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Parent ID:</span>
            <code className="text-sm font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{user?.id}</code>
            <button 
              onClick={() => {
                if (user?.id) {
                  navigator.clipboard.writeText(user.id);
                  alert('Parent ID copied to clipboard!');
                }
              }}
              className="text-xs text-slate-500 hover:text-indigo-600 underline ml-2"
            >
              Copy
            </button>
          </div>
          <button 
            onClick={() => setIsEditProfileOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
          <button 
            onClick={() => setIsLinkModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Search className="w-4 h-4" />
            Link Existing
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Add Child
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : students.length > 0 ? (
        <div className="grid grid-cols-1 gap-8">
          {students.map((data) => (
            <motion.div
              key={data.student.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl overflow-hidden border-2 border-white shadow-sm">
                    {data.student.avatar_url ? (
                      <img src={data.student.avatar_url} alt={data.student.full_name} className="w-full h-full object-cover" />
                    ) : (
                      data.student.full_name[0]
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{data.student.full_name}</h3>
                    <p className="text-slate-500 text-sm">ID: {data.student.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  Linked
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Course Progress</h4>
                {data.courses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.courses.map(course => (
                      <div key={course.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            <span className="font-bold text-slate-900">{course.title}</span>
                          </div>
                          <span className="text-sm font-bold text-indigo-600">{course.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${course.progress}%` }}
                            className="h-full bg-indigo-600 rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                          <span>{course.completed_lessons} / {course.total_lessons} Lessons</span>
                          <span>{course.progress === 100 ? 'Completed' : 'In Progress'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm font-medium">Not enrolled in any courses yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
          <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900">No students linked</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            Link your children's accounts using their Student ID or create a new account for them.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button 
              onClick={() => setIsLinkModalOpen(true)}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Link Existing
            </button>
            <span className="text-slate-300">|</span>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="text-indigo-600 font-bold hover:underline flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditProfileOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                <button 
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <User className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editProfile.fullName}
                    onChange={(e) => setEditProfile({...editProfile, fullName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editProfile.phone}
                    onChange={(e) => setEditProfile({...editProfile, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={editProfile.whatsapp}
                    onChange={(e) => setEditProfile({...editProfile, whatsapp: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editProfile.city}
                    onChange={(e) => setEditProfile({...editProfile, city: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {updatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Student Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLinkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Link Existing Student</h3>
                <button 
                  onClick={() => setIsLinkModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <Search className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleLinkStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Student ID / Username</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={studentUsername}
                      onChange={(e) => setStudentUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="e.g. student123"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    Ask your child for their Student ID or username used to log in.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linking}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {linking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Link Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Child Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Create Student Account</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <Plus className="w-5 h-5 text-slate-400 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddChild} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newChild.fullName}
                      onChange={(e) => setNewChild({...newChild, fullName: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      value={newChild.username}
                      onChange={(e) => setNewChild({...newChild, username: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newChild.password}
                      onChange={(e) => setNewChild({...newChild, password: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                    <input
                      type="text"
                      value={newChild.grade}
                      onChange={(e) => setNewChild({...newChild, grade: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newChild.phone}
                      onChange={(e) => setNewChild({...newChild, phone: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                    <input
                      type="tel"
                      value={newChild.whatsapp}
                      onChange={(e) => setNewChild({...newChild, whatsapp: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={newChild.city}
                      onChange={(e) => setNewChild({...newChild, city: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                    <input
                      type="text"
                      value={newChild.schoolName}
                      onChange={(e) => setNewChild({...newChild, schoolName: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingChild}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {addingChild ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
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
