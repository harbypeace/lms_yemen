import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, CheckCircle2, XCircle, Info } from 'lucide-react';

export const PermissionsDebugger: React.FC = () => {
  const { memberships, activeTenant } = useAuth();
  const myRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;

  const permissions = [
    { name: 'View Courses', allowed: !!myRole },
    { name: 'Create Courses', allowed: ['school_admin', 'teacher'].includes(myRole || '') },
    { name: 'Edit Courses', allowed: ['school_admin', 'teacher'].includes(myRole || '') },
    { name: 'Delete Courses', allowed: ['school_admin'].includes(myRole || '') },
    { name: 'Invite Members', allowed: ['school_admin'].includes(myRole || '') },
    { name: 'Change Roles', allowed: ['school_admin'].includes(myRole || '') },
    { name: 'View Grades', allowed: ['school_admin', 'teacher', 'parent'].includes(myRole || '') },
  ];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 text-slate-300 bg-slate-900/50">
        <Shield className="w-5 h-5 text-indigo-400" />
        <span className="font-mono text-sm font-bold uppercase tracking-wider">Permissions Debugger</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <Info className="w-5 h-5 text-indigo-400" />
          <div>
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Current Role</div>
            <div className="text-lg font-bold text-white capitalize">{myRole?.replace('_', ' ') || 'None'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {permissions.map((p) => (
            <div key={p.name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <span className="text-sm font-medium text-slate-300">{p.name}</span>
              {p.allowed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Technical Context</div>
          <div className="font-mono text-[10px] text-slate-400 break-all">
            Tenant ID: {activeTenant?.id}<br />
            Role: {myRole}
          </div>
        </div>
      </div>
    </div>
  );
};
