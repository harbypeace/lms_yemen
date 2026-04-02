import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const handleCallback = async () => {
      console.log(`AuthCallback attempt ${attempts + 1}, getting session...`);
      // Supabase automatically handles the hash/query params and sets the session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error in AuthCallback getSession:', error);
      }

      if (session) {
        console.log('Session found in AuthCallback, notifying opener...');
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
          // Wait a bit before closing to ensure the message is sent
          setTimeout(() => window.close(), 1000);
        } else {
          console.log('No opener found, redirecting to home...');
          window.location.href = '/';
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        console.warn('No session found in AuthCallback yet, retrying in 500ms...');
        setTimeout(handleCallback, 500);
      } else {
        console.error('Max attempts reached in AuthCallback, no session found.');
        // Fallback to home anyway
        window.location.href = '/';
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Authenticating...</h2>
        <p className="text-slate-500 text-sm">
          Please wait while we complete your sign-in. This window will close automatically.
        </p>
      </div>
    </div>
  );
};
