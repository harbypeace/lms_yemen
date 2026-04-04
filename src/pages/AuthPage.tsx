import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Mail, Lock, Loader2, GraduationCap, User } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isStudentLogin, setIsStudentLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Heartbeat to check for session (fallback for popup communication)
    const heartbeat = setInterval(async () => {
      if (!authLoading && !user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log('Heartbeat detected session, reloading...');
          clearInterval(heartbeat);
          window.location.reload();
        }
      }
    }, 2000);

    return () => clearInterval(heartbeat);
  }, [user, authLoading]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // For students without email, we use a dummy domain suffix
      // This allows them to use Supabase Auth (which requires an email)
      // while only typing their username in the UI.
      const finalEmail = isStudentLogin 
        ? `${username.toLowerCase()}@nexus-internal.com` 
        : email;

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email: finalEmail, 
          password 
        });
        if (error) throw error;
        
        // Force a reload to ensure the auth state is picked up correctly across the app
        if (data.session) {
          window.location.reload();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              username: isStudentLogin ? username : null,
              role: role,
            },
          },
        });
        if (error) throw error;
        alert('Account created! Please sign in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-200"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Nexus LMS</h1>
          <p className="text-slate-500 mt-2">
            {isLogin ? 'Welcome back! Please enter your details.' : 'Create an account to get started.'}
          </p>
        </div>

        {/* Login Type Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
          <button
            onClick={() => setIsStudentLogin(false)}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              !isStudentLogin ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Email Login
          </button>
          <button
            onClick={() => setIsStudentLogin(true)}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
              isStudentLogin ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Student ID Login
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all mb-6"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
            Continue with Google
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">Or with {isStudentLogin ? 'ID' : 'Email'}</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">I am a...</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={cn(
                        "flex-1 py-2 rounded-xl border font-semibold transition-all",
                        role === 'student' 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('parent')}
                      className={cn(
                        "flex-1 py-2 rounded-xl border font-semibold transition-all",
                        role === 'parent' 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Parent
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isStudentLogin ? 'Student ID / Username' : 'Email Address'}
              </label>
              <div className="relative">
                {isStudentLogin ? (
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                )}
                <input
                  type={isStudentLogin ? "text" : "email"}
                  required
                  value={isStudentLogin ? username : email}
                  onChange={(e) => isStudentLogin ? setUsername(e.target.value) : setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder={isStudentLogin ? "student123" : "you@example.com"}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm block w-full"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium"
          >
            Already logged in? Refresh page
          </button>
        </div>
      </motion.div>
    </div>
  );
};
