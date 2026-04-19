import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export const AcceptInvite: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const inviteId = new URLSearchParams(window.location.search).get('id');

  const handleAccept = async () => {
    if (!inviteId || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.rpc('accept_invitation', { 
        invitation_id: inviteId 
      });
      
      if (error) throw error;
      setSuccess(true);
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center"
      >
        {!user ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign in to continue</h1>
            <p className="text-slate-500">
              You need to be signed in to accept this invitation. Please sign in or create an account first.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&mode=signup`}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all text-sm"
              >
                Sign Up
              </button>
              <button 
                onClick={() => window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&mode=login`}
                className="flex-1 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all text-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Invitation Accepted!</h1>
            <p className="text-slate-500">
              Welcome to the school. Redirecting you to your dashboard...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Accept Invitation</h1>
            <p className="text-slate-500">
              You've been invited to join a school on Nexus LMS. Click below to join and start learning.
            </p>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <button 
              onClick={handleAccept}
              disabled={loading || !inviteId}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Accept Invitation
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
