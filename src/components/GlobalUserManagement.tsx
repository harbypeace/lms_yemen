import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Search, 
  Loader2, 
  User as UserIcon,
  Shield,
  Building2,
  Mail,
  ChevronDown,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const GlobalUserManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    fetchGlobalUsers();
  }, []);

  const fetchGlobalUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/system/users', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching global users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterRole === 'all') return matchesSearch;
    
    return matchesSearch && u.memberships?.some((m: any) => m.role === filterRole);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            System User Directory
          </h2>
          <p className="text-slate-500 text-sm mt-1">Global view of all accounts across all tenants</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
          
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm appearance-none font-bold text-sm text-slate-700 cursors-pointer"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admins</option>
              <option value="school_admin">School Admins</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
              <option value="parent">Parents</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button 
            onClick={fetchGlobalUsers}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh"
          >
            <Loader2 className={cn("w-5 h-5 text-slate-500", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Roles & Tenants</th>
                <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">System ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-20 text-center">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">Querying system directory...</p>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-indigo-600 font-black overflow-hidden shrink-0 shadow-inner">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.full_name?.[0] || '?'
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{u.full_name}</p>
                          <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-wrap gap-2">
                        {u.memberships && u.memberships.length > 0 ? (
                          u.memberships.map((m: any, idx: number) => (
                            <div 
                              key={idx}
                              className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center gap-2 group/role"
                            >
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                m.role === 'super_admin' ? "bg-rose-500" :
                                m.role === 'school_admin' ? "bg-amber-500" :
                                m.role === 'teacher' ? "bg-indigo-500" :
                                "bg-emerald-500"
                              )} />
                              <div className="flex flex-col leading-tight">
                                <span className="text-[10px] font-black uppercase text-slate-400 group-hover/role:text-indigo-600 transition-colors">{m.role}</span>
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                  <Building2 className="w-2.5 h-2.5 opacity-50" />
                                  {m.tenants?.name || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-300 text-xs font-bold italic">No active memberships</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5 font-mono text-[10px] text-slate-400">
                      {u.id}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Users className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold">No matching system users found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
