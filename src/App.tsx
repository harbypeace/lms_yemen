import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { AcceptInvite } from './pages/AcceptInvite';
import { StudentOnboarding } from './components/StudentOnboarding';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const path = window.location.pathname;
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // Handle Accept Invite route separately
  if (path === '/accept-invite') {
    return <AcceptInvite />;
  }

  if (!user) {
    return <AuthPage />;
  }

  // Check if student needs onboarding
  const isStudentOrNew = !profile?.role || profile?.role === 'student';
  const needsOnboarding = isStudentOrNew && !profile?.grade && !onboardingComplete;

  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StudentOnboarding onComplete={() => setOnboardingComplete(true)} />
      </div>
    );
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
