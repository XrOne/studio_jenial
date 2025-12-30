import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './components/Login';
import { AdminDashboard } from './components/AdminDashboard';
import Studio from './Studio';
import { Loader2 } from 'lucide-react';

// Main App Content Component
const AppContent: React.FC = () => {
  const { user, isBetaTester, loading, isAdmin } = useAuth();

  // Check for admin route
  const isAdminRoute = window.location.pathname === '/admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user || !isBetaTester) {
    return <Login />;
  }

  if (isAdminRoute && isAdmin) {
    return <AdminDashboard />;
  }

  return <Studio />;
};

// Root App Component
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
