import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Terminal,
  Play,
  Trash2,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MemberList: React.FC = () => {
  const { activeTenant, user: currentUser, memberships: myMemberships, session } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [inviting, setInviting] = useState(false);
  
  // Role Editing state
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  // API Test state
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const myRole = myMemberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdmin = myRole === 'super_admin' || myRole === 'school_admin';

  useEffect(() => {
    if (activeTenant) {
      fetchData();
    }
  }, [activeTenant]);

  const fetchData = async () => {
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('memberships')
        .select('*, profiles(*)')
        .eq('tenant_id', activeTenant?.id),
      supabase
        .from('invitations')
        .select('*')
        .eq('tenant_id', activeTenant?.id)
        .eq('status', 'pending')
    ]);
    
    if (membersRes.data) setMembers(membersRes.data);
    if (invitesRes.data) setInvitations(invitesRes.data);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !currentUser) return;
    
    setInviting(true);
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          tenantId: activeTenant.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error sending invitation');
      }

      setInvitations([result.invitation, ...invitations]);
      setIsModalOpen(false);
      setInviteEmail('');
      setInviteRole('student');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberId: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from('memberships')
      .update({ role: newRole })
      .eq('id', memberId);

    if (!error) {
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setEditingMember(null);
    } else {
      alert(error.message);
    }
    setUpdating(false);
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', memberId);

    if (!error) {
      setMembers(members.filter(m => m.id !== memberId));
    } else {
      alert(error.message);
    }
  };

  const testApi = async () => {
    setApiLoading(true);
    try {
      const { data, error, status } = await supabase
        .from('tenants')
        .select('*')
        .limit(1);
      
      setApiResult({ 
        endpoint: 'GET /tenants',
        status,
        data,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setApiResult({ error: err.message });
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* API Tester Section */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-300">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span className="font-mono text-sm font-bold uppercase tracking-wider">API Connection & RLS Tester</span>
          </div>
          <button 
            onClick={testApi}
            disabled={apiLoading}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
          >
            {apiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Test
          </button>
        </div>
        <div className="p-6 font-mono text-xs">
          {apiResult ? (
            <pre className="text-emerald-400 overflow-x-auto">
              {JSON.stringify(apiResult, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-500 italic">Click "Run Test" to verify Supabase API connection and RLS policies.</div>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Members & Invitations</h2>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <UserPlus className="w-5 h-5" />
            Invite Member
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Members */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Active Members ({members.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Joined</th>
                    {isAdmin && <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {member.profiles?.full_name?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{member.profiles?.full_name || 'Unknown User'}</div>
                            <div className="text-xs text-slate-500">{member.profiles?.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingMember === member.id ? (
                          <select 
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="school_admin">School Admin</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="parent">Parent</option>
                          </select>
                        ) : (
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold uppercase tracking-wider">
                            {member.role.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            {editingMember === member.id ? (
                              <>
                                <button 
                                  onClick={() => updateRole(member.id)}
                                  disabled={updating}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                >
                                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </button>
                                <button 
                                  onClick={() => setEditingMember(null)}
                                  className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => { setEditingMember(member.id); setNewRole(member.role); }}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                  <Shield className="w-4 h-4" />
                                </button>
                                {member.user_id !== currentUser?.id && (
                                  <button 
                                    onClick={() => removeMember(member.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Pending Invitations ({invitations.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {invitations.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{invite.email}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-widest">{invite.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Sent {new Date(invite.created_at).toLocaleDateString()}</span>
                      {isAdmin && (
                        <button className="p-2 text-slate-400 hover:text-red-500 transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
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
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Invite New Member</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="colleague@school.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="school_admin">School Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="parent">Parent</option>
                    </select>
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
                    disabled={inviting}
                    className="flex-1 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {inviting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invite'}
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
