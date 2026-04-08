/** App router and page layout composition for stock analyzer frontend. */

import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/shared/Navbar";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import StockDetail from "./pages/StockDetail";
import Portfolio from "./pages/Portfolio";
import Backtest from "./pages/Backtest";
import Alerts from "./pages/Alerts";
import Heatmap from "./pages/Heatmap";
import SectorAnalysis from "./pages/SectorAnalysis";
import Login from "./pages/Login";
import { useAuth } from "./context/AuthContext";

/**
 * Protected route wrapper.
 * @param {{children: JSX.Element}} props
 * @returns {JSX.Element}
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Root app component.
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-bg text-text">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/sectors" element={<SectorAnalysis />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <Portfolio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}
