import React, { useState, useEffect } from 'react';
import { supabase, Tenant } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  School, 
  Search, 
  UserPlus, 
  Shield, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SchoolManagement: React.FC = () => {
  const { activeTenant, setActiveTenant, memberships, session } = useAuth();
  const [schools, setSchools] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolSlug, setNewSchoolSlug] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerRole, setManagerRole] = useState<'school_admin' | 'teacher' | 'student' | 'parent'>('school_admin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isGeneralAdmin = memberships.some(m => m.tenants?.slug === 'general' && m.role === 'super_admin');

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .neq('slug', 'general')
      .order('name');
    
    if (error) {
      console.error('Error fetching schools:', error);
    } else {
      setSchools(data || []);
    }
    setLoading(false);
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: newSchoolName,
          slug: newSchoolSlug,
          managerEmail,
          managerRole
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create school');
      }

      setSuccess(`School "${newSchoolName}" created successfully!`);
      setNewSchoolName('');
      setNewSchoolSlug('');
      setManagerEmail('');
      setManagerRole('school_admin');
      setIsCreating(false);
      fetchSchools();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSchool = async (schoolId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if already a member
      const { data: existing } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', schoolId)
        .single();

      if (existing) {
        throw new Error('You are already a member of this school.');
      }

      const { error: joinError } = await supabase
        .from('memberships')
        .insert([{
          user_id: user.id,
          tenant_id: schoolId,
          role: 'student' // Default role when joining
        }]);

      if (joinError) throw joinError;

      setSuccess('Successfully joined the school!');
      // Refresh page to pick up new membership
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Schools & Institutions</h3>
          <p className="text-slate-500 text-sm">Browse and join schools or manage existing ones.</p>
        </div>
        {isGeneralAdmin && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Create School
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateSchool} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
                  <input
                    type="text"
                    required
                    value={newSchoolName}
                    onChange={(e) => {
                      setNewSchoolName(e.target.value);
                      if (!newSchoolSlug) {
                        setNewSchoolSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Springfield High School"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">School Slug (URL)</label>
                  <input
                    type="text"
                    required
                    value={newSchoolSlug}
                    onChange={(e) => setNewSchoolSlug(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. springfield-high"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manager Email</label>
                  <input
                    type="email"
                    required
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="manager@school.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manager Role</label>
                  <select
                    value={managerRole}
                    onChange={(e) => setManagerRole(e.target.value as any)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="school_admin">School Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create School'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && schools.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p>Loading schools...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
            <School className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="text-slate-900 font-bold">No schools found</h4>
            <p className="text-slate-500 text-sm">Be the first to create a school!</p>
          </div>
        ) : (
          schools.map((school) => (
            <motion.div
              key={school.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <School className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ID: {school.slug}
                </span>
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">{school.name}</h4>
              <p className="text-sm text-slate-500 mb-6">Join this institution to access its courses and community.</p>
              
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleJoinSchool(school.id)}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Join School
                </button>
                {isGeneralAdmin && (
                  <button 
                    onClick={() => setActiveTenant(school)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Manage School"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
