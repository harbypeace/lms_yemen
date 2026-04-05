import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { BulkImport } from './BulkImport';
import { 
  Users, 
  Search, 
  Link as LinkIcon, 
  Key, 
  Loader2, 
  UserPlus, 
  CheckCircle, 
  AlertCircle,
  Phone,
  User as UserIcon,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const UserManagement: React.FC = () => {
  const { activeTenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'students' | 'parents' | 'bulk-import'>('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [linkingParent, setLinkingParent] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parents, setParents] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (activeTenant && activeTab !== 'bulk-import') {
      fetchUsers();
    }
  }, [activeTenant, activeTab]);

  const fetchUsers = async () => {
    if (activeTab === 'bulk-import') return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, memberships!inner(*)')
        .eq('memberships.tenant_id', activeTenant?.id)
        .eq('role', activeTab === 'students' ? 'student' : 'parent')
        .ilike('full_name', `%${searchQuery}%`)
        .limit(50);

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchParents = async (phone: string) => {
    if (!phone || phone.length < 3) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/parents?tenantId=${activeTenant?.id}&phone=${phone}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setParents(data.parents);
      }
    } catch (err) {
      console.error('Error searching parents:', err);
    }
  };

  const linkParent = async (parentId: string) => {
    if (!selectedUser || !activeTenant) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/link-parent-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          parentId,
          studentId: selectedUser.id,
          tenantId: activeTenant.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setStatus({ type: 'success', message: 'Parent linked successfully!' });
        setLinkingParent(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (userId: string) => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          targetUserId: userId,
          tenantId: activeTenant.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setStatus({ type: 'success', message: `Reset link generated: ${data.resetLink}` });
        // In a real app, you'd copy this to clipboard or send an email
        navigator.clipboard.writeText(data.resetLink);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('students')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeTab === 'students' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab('parents')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeTab === 'parents' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Parents
          </button>
          <button
            onClick={() => setActiveTab('bulk-import')}
            className={cn(
              "px-6 py-2 rounded-xl font-bold text-sm transition-all",
              activeTab === 'bulk-import' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Bulk Import
          </button>
        </div>

        {activeTab !== 'bulk-import' && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        )}
      </div>

      {status && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-center justify-between gap-3",
            status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
          )}
        >
          <div className="flex items-center gap-3">
            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-sm font-medium">{status.message}</p>
          </div>
          <button onClick={() => setStatus(null)}><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {activeTab === 'bulk-import' ? (
        <BulkImport onComplete={() => {
          setStatus({ type: 'success', message: 'Bulk import completed successfully.' });
        }} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {loading && users.length === 0 ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Loading users...</p>
              </div>
            ) : users.length > 0 ? (
              users.map((u) => (
                <div key={u.id} className="p-4 hover:bg-slate-50 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                      ) : (
                        u.full_name?.[0] || '?'
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{u.full_name}</h4>
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-1">
                        <span className="flex items-center gap-1 uppercase tracking-wider">
                          <UserIcon className="w-3 h-3" />
                          {u.role}
                        </span>
                        {u.grade && (
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full">Grade {u.grade}</span>
                        )}
                        {u.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {u.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    {activeTab === 'students' && (
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setLinkingParent(true);
                          setParents([]);
                          setParentSearch('');
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Link Parent"
                      >
                        <LinkIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => resetPassword(u.id)}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                      title="Reset Password"
                    >
                      <Key className="w-5 h-5" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">No users found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Parent Modal */}
      <AnimatePresence>
        {linkingParent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setLinkingParent(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Link Parent to {selectedUser?.full_name}</h3>
                <button onClick={() => setLinkingParent(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search parent by phone number..."
                    value={parentSearch}
                    onChange={(e) => {
                      setParentSearch(e.target.value);
                      searchParents(e.target.value);
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {parents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => linkParent(p.id)}
                      className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                          {p.full_name?.[0]}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-900">{p.full_name}</p>
                          <p className="text-xs text-slate-500">{p.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <UserPlus className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-all" />
                    </button>
                  ))}
                  {parentSearch.length >= 3 && parents.length === 0 && (
                    <p className="text-center text-slate-400 py-8 text-sm">No parents found with this phone number.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
