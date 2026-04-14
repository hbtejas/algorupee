/** Main navigation bar across stock analyzer routes. */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Top navbar.
 * @returns {JSX.Element}
 */
export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-mono text-base font-bold text-primary sm:text-lg" onClick={closeMobileMenu}>
          AI Stock Analyzer
        </Link>

        <button
          type="button"
          className="inline-flex items-center rounded-md border border-white/20 px-3 py-1 text-xs sm:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>

        <nav className="hidden items-center gap-4 text-sm sm:flex">
          <NavLink to="/" className="hover:text-primary" onClick={closeMobileMenu}>
            Dashboard
          </NavLink>
          <NavLink to="/backtest" className="hover:text-primary" onClick={closeMobileMenu}>
            Backtest
          </NavLink>
          <NavLink to="/heatmap" className="hover:text-primary" onClick={closeMobileMenu}>
            Heatmap
          </NavLink>
          <NavLink to="/sectors" className="hover:text-primary" onClick={closeMobileMenu}>
            Sectors
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/portfolio" className="hover:text-primary" onClick={closeMobileMenu}>
                Portfolio
              </NavLink>
              <NavLink to="/alerts" className="hover:text-primary" onClick={closeMobileMenu}>
                Alerts
              </NavLink>
            </>
          )}
          {isAuthenticated ? (
            <button type="button" onClick={() => { logout(); closeMobileMenu(); }} className="rounded-md border border-white/20 px-3 py-1 hover:border-primary">
              Logout
            </button>
          ) : (
            <NavLink to="/login" className="rounded-md border border-primary/60 px-3 py-1 text-primary hover:bg-primary/10" onClick={closeMobileMenu}>
              Login
            </NavLink>
          )}
        </nav>
      </div>

      {mobileOpen && (
        <nav className="border-t border-white/10 px-4 pb-3 pt-2 text-sm sm:hidden">
          <div className="grid gap-2">
            <NavLink to="/" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
              Dashboard
            </NavLink>
            <NavLink to="/backtest" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
              Backtest
            </NavLink>
            <NavLink to="/heatmap" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
              Heatmap
            </NavLink>
            <NavLink to="/sectors" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
              Sectors
            </NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/portfolio" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
                  Portfolio
                </NavLink>
                <NavLink to="/alerts" className="rounded px-2 py-1 hover:bg-white/10" onClick={closeMobileMenu}>
                  Alerts
                </NavLink>
              </>
            )}
            {isAuthenticated ? (
              <button type="button" onClick={() => { logout(); closeMobileMenu(); }} className="rounded border border-white/20 px-2 py-1 text-left hover:border-primary">
                Logout
              </button>
            ) : (
              <NavLink to="/login" className="rounded border border-primary/60 px-2 py-1 text-primary hover:bg-primary/10" onClick={closeMobileMenu}>
                Login
              </NavLink>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
