/** Authentication context for managing user session and JWT state. */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, getApiError } from "../utils/api";

const AuthContext = createContext(null);

/**
 * Authentication provider component.
 * @param {{children: import('react').ReactNode}} props
 * @returns {JSX.Element}
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    /** Restore current user from token. */
    async function loadUser() {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.me();
        setUser(data.user);
      } catch (err) {
        localStorage.removeItem("token");
        setError(getApiError(err));
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  /**
   * Register and persist token.
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async function register(payload) {
    setError("");
    try {
      const { data } = await authApi.register(payload);
      localStorage.setItem("token", data.token);
      setUser(data.user);
    } catch (err) {
      setError(getApiError(err));
      throw err;
    }
  }

  /**
   * Login and persist token.
   * @param {object} payload
   * @returns {Promise<void>}
   */
  async function login(payload) {
    setError("");
    try {
      const { data } = await authApi.login(payload);
      localStorage.setItem("token", data.token);
      setUser(data.user);
    } catch (err) {
      setError(getApiError(err));
      throw err;
    }
  }

  /** Clear auth state and token. */
  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, error, isAuthenticated: Boolean(user), register, login, logout }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook for auth context.
 * @returns {any}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
