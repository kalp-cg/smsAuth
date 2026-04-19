import './App.css';
import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import DocsPage from './DocsPage';

function isDocsMode() {
  if (typeof window === 'undefined') return false;

  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();

  return path.endsWith('/docs') || hash === '#/docs' || search.includes('docs=1');
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();

  return (
    <main className="welcome-screen">
      <section className="welcome-card">
        <h1 className="welcome-title">Welcome</h1>
        <p className="welcome-subtitle">You are logged in.</p>
        <p className="welcome-meta">{user?.phoneNumber ?? 'Unknown user'}</p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={logout} id="logout-btn">
            Log out
          </button>
        </div>
      </section>
    </main>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function AppContent() {
  if (isDocsMode()) {
    return <DocsPage />;
  }

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-logo">SMS</div>
        <div className="auth-loading-text">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
