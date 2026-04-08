import SectorOutlookCard from "./SectorOutlookCard";
import SectorScoreRadar from "./SectorScoreRadar";

/**
 * Sector detail side panel.
 * @param {{sector:any}} props
 * @returns {JSX.Element}
 */
export default function SectorDetailPanel({ sector }) {
  if (!sector) {
    return <div className="card text-sm text-white/65">Select a sector to view details.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="card">
        <p className="text-sm font-semibold text-white/90">{sector?.sector_name}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70">
          <p>Composite</p>
          <p className="text-right font-mono">{Number(sector?.composite_score || 0).toFixed(1)}</p>
          <p>Market Cap</p>
          <p className="text-right font-mono">{Number(sector?.market_cap_total || 0).toLocaleString("en-IN")}</p>
          <p>Stocks</p>
          <p className="text-right font-mono">{Number(sector?.stocks_count || 0)}</p>
          <p>Above MA50</p>
          <p className="text-right font-mono">{Number(sector?.stocks_above_ma50_pct || 0).toFixed(1)}%</p>
        </div>
      </div>
      <SectorScoreRadar sector={sector} />
      <SectorOutlookCard sector={sector} />
    </div>
  );
}
