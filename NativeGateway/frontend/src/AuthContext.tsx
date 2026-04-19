import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthUser {
  phoneNumber: string;
  isVerified: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
}

const AUTH_API =
  (import.meta.env.VITE_AUTH_API as string | undefined) ||
  `${window.location.protocol}//${window.location.hostname}:3002`;
const STORAGE_KEY_TOKEN = 'kalp_auth_token';
const STORAGE_KEY_USER = 'kalp_auth_user';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate a stored token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    // Validate the token against the auth service
    fetch(`${AUTH_API}/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Invalid token');
        const data = await r.json();
        setToken(savedToken);
        setUser(data.user);
      })
      .catch(() => {
        // Token is invalid/expired — clear it
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);

        // If we had a saved user but token is invalid, still clear
        if (savedUser) {
          localStorage.removeItem(STORAGE_KEY_USER);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${AUTH_API}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort logout — clear locally regardless
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AUTH_API };
