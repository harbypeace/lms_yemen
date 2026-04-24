import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Save, Loader2, Link as LinkIcon, Info, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const SchoolSettings: React.FC = () => {
  const { activeTenant, memberships, setActiveTenant, session } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const activeRole = memberships.find(m => m.tenant_id === activeTenant?.id)?.role;
  const isAdmin = activeRole === 'school_admin' || activeRole === 'super_admin';

  useEffect(() => {
    if (activeTenant) {
      setName(activeTenant.name);
      setSlug(activeTenant.slug);
    }
  }, [activeTenant]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-slate-500 mt-2">Only school administrators can access this page.</p>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;

    setIsSaving(true);
    setMessage(null);

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      setMessage({ type: 'error', text: 'School slug can only contain lowercase letters, numbers, and hyphens.' });
      setIsSaving(false);
      return;
    }

    if (!name.trim()) {
      setMessage({ type: 'error', text: 'School name cannot be empty.' });
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/schools/${activeTenant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ name, slug })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update school settings');
      }

      setMessage({ type: 'success', text: 'School settings updated successfully.' });
      
      // Update local tenant info
      setActiveTenant(result.school);
      
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">School Settings</h2>
            <p className="text-slate-500">Manage your school's core identity and configuration.</p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl mb-6 font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">School Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-semibold"
                placeholder="e.g. Springfield High"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">School URL Slug</label>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 border border-slate-200">
                  <LinkIcon className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                  placeholder="springfield-high"
                />
              </div>
              <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                <Info className="w-4 h-4" />
                This is used for custom URLs and integration endpoints.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || (name === activeTenant?.name && slug === activeTenant?.slug)}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 flex items-start gap-4">
        <div className="w-12 h-12 bg-white text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
          <Info className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-indigo-900 mb-2">Subscription & Limits</h3>
          <p className="text-indigo-700 mb-4">
            Manage your school's current plan, features, and billing in the Subscriptions tab.
          </p>
          <button onClick={() => navigate('/subscriptions')} className="font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-4">
            Go to Subscriptions &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
