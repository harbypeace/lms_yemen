import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { AcceptInvite } from './pages/AcceptInvite';
import { AuthCallback } from './pages/AuthCallback';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const path = window.location.pathname;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // Handle Auth Callback route separately
  if (path === '/auth/callback') {
    return <AuthCallback />;
  }

  // Handle Accept Invite route separately
  if (path === '/accept-invite') {
    return <AcceptInvite />;
  }

  return user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
