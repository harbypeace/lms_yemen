import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Cloud, RefreshCw, CheckCircle, AlertCircle, LogIn, Folder, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

declare const google: any;

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '148007328904-u8n8f6b0f0f0f0f0f0f0f0f0f0f0f0f0.apps.googleusercontent.com';

export const GDriveAssetSync: React.FC = () => {
  const { user, activeTenant, memberships } = useAuth();
  const isAdmin = memberships.find(m => m.tenant_id === activeTenant?.id)?.role === 'super_admin';
  
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState('');
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [verificationResults, setVerificationResults] = useState<any[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center">
        <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only system administrators can sync Google Drive assets.</p>
      </div>
    );
  }

  const handleGoogleLogin = () => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setStatus('idle');
          } else {
            setError('Failed to obtain Google access token.');
          }
        },
      });
      client.requestAccessToken();
    } catch (err) {
      console.error('Google Auth Error:', err);
      setError('Please ensure Google Identity Services is loaded correctly.');
    }
  };

  const verifySync = async () => {
    setIsVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/sync/verify', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setVerificationResults(result.results);
      }
    } catch (err) {
      console.error('Verification Error:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const startSync = async () => {
    if (!accessToken || !folderId) return;
    
    setStatus('syncing');
    setError(null);
    setSyncLogs(['Initializing sync...', `Target Folder ID: ${folderId}`]);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/sync/gdrive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          folderId,
          googleAccessToken: accessToken
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus('success');
        setSyncLogs(prev => [...prev, ...result.logs, 'Sync completed successfully!']);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err: any) {
      console.error('Sync Error:', err);
      setStatus('error');
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <Cloud className="w-8 h-8" />
              <h1 className="text-2xl font-black">Static Asset Sync</h1>
            </div>
            <p className="text-indigo-100 font-medium max-w-md">
              Synchronize lesson HTML assets and resources directly from a Google Drive folder into the Nexus static folder.
            </p>
          </div>
          <motion.div 
            className="absolute -right-10 -bottom-10 opacity-10"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-64 h-64" />
          </motion.div>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">Sync Controls</h3>
            <button
              onClick={verifySync}
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl transition-all"
            >
              {isVerifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Scan Existing Assets
            </button>
          </div>

          {!accessToken ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <LogIn className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Google Drive Authorization</h3>
                <p className="text-slate-500 mt-2">Grant permission to access your Drive files to begin the sync process.</p>
              </div>
              <button
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-3 bg-white border-2 border-slate-200 text-slate-700 px-8 py-3 rounded-2xl font-bold hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm"
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" className="w-5 h-5" alt="Google" />
                Authorize Google Drive
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-900 font-bold">Authorized</span>
                </div>
                <button 
                  onClick={() => setAccessToken(null)}
                  className="text-emerald-700 hover:underline text-sm font-bold"
                >
                  Switch Account
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">GDrive Folder ID</label>
                  <div className="relative">
                    <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      placeholder="Enter the folder ID from the Drive URL..."
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 px-1">
                    * Tip: The ID is the long string of characters at the end of your folder's URL.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    disabled={status === 'syncing' || !folderId}
                    onClick={startSync}
                    className={cn(
                      "flex items-center gap-3 px-10 py-4 rounded-2xl font-bold transition-all shadow-lg",
                      status === 'syncing' 
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed shadow-none" 
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    {status === 'syncing' ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Syncing Files...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Start Synchronizing
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Display */}
              <AnimatePresence>
                {verificationResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-4 border-t border-slate-100"
                  >
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                       <Folder className="w-4 h-4 text-indigo-600" />
                       Subcourse Verification Report
                    </h4>
                    <div className="grid gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {verificationResults.map((res) => (
                        <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 truncate max-w-[200px]">{res.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{res.slug || 'no-slug'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className={cn("text-[10px] font-black uppercase", res.hasFolder ? "text-emerald-600" : "text-red-400")}>
                                {res.hasFolder ? 'Folder OK' : 'Missing Folder'}
                              </span>
                              <span className="text-[10px] text-slate-500">{res.structure}</span>
                            </div>
                            {res.hasFolder ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-300 shrink-0" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {status !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-slate-100"
                  >
                    {status === 'error' && (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div className="text-red-900 font-medium">{error}</div>
                      </div>
                    )}
                    
                    {status === 'success' && (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                        <div className="text-emerald-900 font-medium">Assets successfully synchronized!</div>
                      </div>
                    )}

                    <div className="bg-slate-900 rounded-2xl p-6 overflow-hidden">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-indigo-400 font-mono text-xs font-bold uppercase tracking-widest">Live Sync Logs</h4>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                      </div>
                      <div className="font-mono text-xs text-indigo-100/70 space-y-1 h-32 overflow-y-auto no-scrollbar">
                        {syncLogs.length === 0 ? (
                          <div className="opacity-30">Waiting for trigger...</div>
                        ) : (
                          syncLogs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="opacity-30">[{i+1}]</span>
                              <span>{log}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
