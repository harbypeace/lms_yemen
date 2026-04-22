import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { AcceptInvite } from './pages/AcceptInvite';
import { StudentOnboarding } from './components/StudentOnboarding';
import { GamificationOverlay } from './components/GamificationOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
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

  return <>{children}</>;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
          <GamificationOverlay />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
