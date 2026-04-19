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
  AlertCircle,
  Edit2,
  Trash2,
  X,
  History,
  Building2,
  Users,
  Copy,
  ExternalLink
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
  const [editingSchool, setEditingSchool] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);

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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (managerEmail && !emailRegex.test(managerEmail)) {
      setError('Please enter a valid email address for the manager.');
      setLoading(false);
      return;
    }

    // Slug validation
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(newSchoolSlug)) {
      setError('School slug can only contain lowercase letters, numbers, and hyphens.');
      setLoading(false);
      return;
    }

    if (!newSchoolName.trim()) {
      setError('School name cannot be empty.');
      setLoading(false);
      return;
    }

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

      if (result.invitation) {
        const inviteLink = `${window.location.origin}/accept-invite?id=${result.invitation.id}`;
        setLastInviteLink(inviteLink);
      }

      if (result.temporaryPassword) {
        setCreatedTempPassword(result.temporaryPassword);
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
          role: isGeneralAdmin ? 'school_admin' : 'student' // Super Admins join as school_admin
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

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/schools/${editingSchool.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: editingSchool.name,
          slug: editingSchool.slug
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update school');

      setSuccess(`School "${editingSchool.name}" updated successfully!`);
      setEditingSchool(null);
      fetchSchools();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchool = async (schoolId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete school');

      setSuccess('School deleted successfully');
      setDeleteConfirm(null);
      fetchSchools();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Institution Management
          </h3>
          <p className="text-slate-500 text-sm">Monitor and orchestrate cross-school operations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter institutions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
            />
          </div>
          {isGeneralAdmin && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              New School
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">{success}</span>
          </div>
          {lastInviteLink && (
            <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block mb-1">Invitation Link</span>
                  <div className="truncate text-xs font-mono text-emerald-800 bg-emerald-50/50 p-2 rounded-lg">
                    {lastInviteLink}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(lastInviteLink);
                    }}
                    className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all"
                    title="Copy Link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={lastInviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all"
                    title="Open Link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {createdTempPassword && (
                <div className="pt-3 border-t border-emerald-50">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest block mb-1">Generated Account Password</span>
                  <div className="flex items-center justify-between gap-3 bg-amber-50/50 p-2 rounded-lg border border-amber-100/50">
                    <span className="text-xs font-mono font-bold text-amber-800">{createdTempPassword}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdTempPassword);
                      }}
                      className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition-all"
                      title="Copy Password"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    The manager has been pre-registered. Share this password with them securely.
                  </p>
                </div>
              )}
            </div>
          )}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                    <span>Manager Email</span>
                    <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tight flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Check Account Email
                    </span>
                  </label>
                  <input
                    type="email"
                    required
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    placeholder="manager@school.com"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    Note: If using <strong>onboarding@resend.dev</strong>, you can only send to your own account email.
                  </p>
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
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
            <p className="font-bold">Syncing institution data...</p>
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
            <School className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h4 className="text-slate-900 font-black uppercase tracking-tight">No institutions found</h4>
            <p className="text-slate-500 text-sm">Refine your search or create a new branch.</p>
          </div>
        ) : (
          filteredSchools.map((school) => (
            <motion.div
              key={school.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden"
            >
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[100px] -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-all" />

              <div className="flex items-start justify-between mb-6 relative">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                  <School className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">SLUG</span>
                  <span className="text-xs font-bold text-slate-900 font-mono">/{school.slug}</span>
                </div>
              </div>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{school.name}</h4>
                  {school.status === 'pending' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-200">
                      Pending Activation
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                  <History className="w-3.5 h-3.5" />
                  Created {new Date(school.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 relative">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleJoinSchool(school.id)}
                    disabled={loading || school.status === 'pending'}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-lg shadow-slate-200"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {school.status === 'pending' ? 'Locked' : 'Join Branch'}
                  </button>
                </div>
                
                {isGeneralAdmin && (
                  <div className="flex items-center gap-1">
                    {school.status === 'pending' && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          const { data, error } = await supabase
                            .from('invitations')
                            .select('id')
                            .eq('tenant_id', school.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();
                          
                          if (data) {
                            const inviteLink = `${window.location.origin}/accept-invite?id=${data.id}`;
                            setLastInviteLink(inviteLink);
                            setSuccess(`Retrieved invitation for ${school.name}`);
                          } else {
                            setError('No active invitation found for this school.');
                          }
                          setLoading(false);
                        }}
                        className="p-2.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Copy Invitation Link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => setEditingSchool(school)}
                      className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Edit Institution"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(school.id)}
                      className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Decommission Branch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setActiveTenant(school)}
                      className="p-2.5 text-indigo-100 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Enter Control Center"
                    >
                      <Shield className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Confirmation Overlay */}
              <AnimatePresence>
                {deleteConfirm === school.id && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center"
                  >
                    <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                    <h5 className="font-black text-slate-900 uppercase tracking-tight mb-2">Decommission Branch?</h5>
                    <p className="text-xs text-slate-500 mb-6 font-bold uppercase tracking-widest px-4">All data, courses, and memberships will be purged. This action is terminal.</p>
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                      >
                        Abort
                      </button>
                      <button 
                        onClick={() => handleDeleteSchool(school.id)}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                      >
                        Confirm Purge
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* Edit School Modal */}
      <AnimatePresence>
        {editingSchool && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setEditingSchool(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Modify Institution</h3>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">ID: {editingSchool.id}</p>
                </div>
                <button onClick={() => setEditingSchool(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateSchool} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Official Name</label>
                    <input
                      type="text"
                      required
                      value={editingSchool.name}
                      onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-slate-700 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">System Identifier (Slug)</label>
                    <input
                      type="text"
                      required
                      value={editingSchool.slug}
                      onChange={(e) => setEditingSchool({ ...editingSchool, slug: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-bold text-slate-700 font-mono transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingSchool(null)}
                    className="flex-1 py-3 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Dismiss
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Mutations'}
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
