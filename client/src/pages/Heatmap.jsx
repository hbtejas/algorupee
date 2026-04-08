/** Dedicated market heatmap page for live NIFTY 50 and SENSEX view. */

import MarketHeatmap from "../components/dashboard/MarketHeatmap";

/**
 * Heatmap page route.
 * @returns {JSX.Element}
 */
export default function Heatmap() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-lg font-semibold text-white">Live Market Heatmap</h1>
        <p className="mt-1 text-sm text-white/65">
          Real-time sector spread with NIFTY 50 and SENSEX toggles, top gainers/losers, and treemap view.
        </p>
      </div>

      <MarketHeatmap fullPage />
    </div>
  );
}
