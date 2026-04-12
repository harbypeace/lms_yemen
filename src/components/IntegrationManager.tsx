import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Share2, Plus, Trash2, RefreshCw, CheckCircle, XCircle, ExternalLink, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Integration {
  id: string;
  name: string;
  provider: string;
  endpoint_url: string;
  is_active: boolean;
  events: string[];
  created_at: string;
}

interface SyncLog {
  id: string;
  event_type: string;
  status: string;
  created_at: string;
  error_message?: string;
}

export const IntegrationManager: React.FC = () => {
  const { user, activeTenant } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    provider: 'webhook',
    endpointUrl: '',
    apiKey: '',
    events: ['lesson_completed']
  });

  useEffect(() => {
    if (user && activeTenant) {
      fetchIntegrations();
    }
  }, [user, activeTenant]);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('tenant_id', activeTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);

      if (data && data.length > 0) {
        fetchLogs(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (integrationId: string) => {
    try {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleAddIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTenant) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...newIntegration,
          tenantId: activeTenant.id
        })
      });

      const result = await response.json();
      if (result.success) {
        setIntegrations([result.integration, ...integrations]);
        setShowAddModal(false);
        setNewIntegration({
          name: '',
          provider: 'webhook',
          endpointUrl: '',
          apiKey: '',
          events: ['lesson_completed']
        });
      }
    } catch (err) {
      console.error('Error adding integration:', err);
    }
  };

  const triggerSync = async (integrationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          integrationId,
          eventType: 'manual_sync',
          payload: { triggered_by: user?.id, timestamp: new Date().toISOString() }
        })
      });

      const result = await response.json();
      if (result.success) {
        fetchLogs(integrationId);
      }
    } catch (err) {
      console.error('Error triggering sync:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Integrations</h2>
          <p className="text-slate-500 mt-1 font-medium">Connect Nexus with external systems and automate your workflow.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Add Integration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-10 h-10 animate-spin mb-4" />
              <p className="font-bold">Loading integrations...</p>
            </div>
          ) : integrations.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No Integrations Yet</h3>
              <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                Connect with Zapier, Slack, or your own custom webhooks to sync learning data.
              </p>
            </div>
          ) : (
            integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <ExternalLink className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{integration.name}</h4>
                      <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">{integration.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => triggerSync(integration.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Trigger Manual Sync"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-6 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-bold">Endpoint URL</span>
                    <span className="text-slate-900 font-mono truncate max-w-[300px]">{integration.endpoint_url}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-bold">Status</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      integration.is_active ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-600"
                    )}>
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {integration.events.map(event => (
                      <span key={event} className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600" />
              Recent Sync Activity
            </h3>
            <div className="space-y-4">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No recent activity.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{log.event_type}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-1 line-clamp-1">{log.error_message}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Integration Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">New Integration</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddIntegration} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Integration Name</label>
                  <input
                    type="text"
                    required
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g., My Custom Webhook"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Provider</label>
                  <select
                    value={newIntegration.provider}
                    onChange={(e) => setNewIntegration({ ...newIntegration, provider: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="webhook">Webhook</option>
                    <option value="zapier">Zapier</option>
                    <option value="slack">Slack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Endpoint URL</label>
                  <input
                    type="url"
                    required
                    value={newIntegration.endpointUrl}
                    onChange={(e) => setNewIntegration({ ...newIntegration, endpointUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://api.example.com/webhook"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">API Key (Optional)</label>
                  <input
                    type="password"
                    value={newIntegration.apiKey}
                    onChange={(e) => setNewIntegration({ ...newIntegration, apiKey: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="••••••••••••••••"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4"
                >
                  Create Integration
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper components
const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
