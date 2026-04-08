/** Main navigation bar across stock analyzer routes. */

import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Top navbar.
 * @returns {JSX.Element}
 */
export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-mono text-lg font-bold text-primary">
          AI Stock Analyzer
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" className="hover:text-primary">
            Dashboard
          </NavLink>
          <NavLink to="/backtest" className="hover:text-primary">
            Backtest
          </NavLink>
          <NavLink to="/heatmap" className="hover:text-primary">
            Heatmap
          </NavLink>
          <NavLink to="/sectors" className="hover:text-primary">
            Sectors
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/portfolio" className="hover:text-primary">
                Portfolio
              </NavLink>
              <NavLink to="/alerts" className="hover:text-primary">
                Alerts
              </NavLink>
            </>
          )}
          {isAuthenticated ? (
            <button type="button" onClick={logout} className="rounded-md border border-white/20 px-3 py-1 hover:border-primary">
              Logout
            </button>
          ) : (
            <NavLink to="/login" className="rounded-md border border-primary/60 px-3 py-1 text-primary hover:bg-primary/10">
              Login
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
