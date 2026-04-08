/** Login and registration page for JWT-based authentication flows. */

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Login route component.
 * @returns {JSX.Element}
 */
export default function Login() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, error } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  /**
   * Handle auth form submit.
   * @param {import('react').FormEvent} e
   */
  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
      navigate("/");
    } catch (_) {
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={onSubmit} className="card space-y-3">
        <h2 className="text-xl font-bold">{mode === "login" ? "Login" : "Create Account"}</h2>
        {mode === "register" && (
          <input
            className="w-full rounded border border-white/20 bg-white/5 px-3 py-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            required
          />
        )}
        <input
          className="w-full rounded border border-white/20 bg-white/5 px-3 py-2"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
          required
        />
        <input
          className="w-full rounded border border-white/20 bg-white/5 px-3 py-2"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          required
        />
        {error && <p className="text-sm text-sell">{error}</p>}
        <button type="submit" disabled={submitting} className="w-full rounded bg-primary px-3 py-2 font-semibold text-black">
          {submitting ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
        <button type="button" className="text-sm text-primary" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </form>
    </div>
  );
}
