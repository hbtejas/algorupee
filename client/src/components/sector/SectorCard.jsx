import { formatPercent } from "../../utils/formatters";

function signalClass(signal) {
  if (signal === "BUY") return "text-buy border-buy/40 bg-buy/10";
  if (signal === "AVOID") return "text-sell border-sell/40 bg-sell/10";
  return "text-amber-300 border-amber-300/40 bg-amber-300/10";
}

/**
 * Compact card for one sector.
 * @param {{sector:any, changed:boolean, onOpen:()=>void, onOpenPage?:()=>void}} props
 * @returns {JSX.Element}
 */
export default function SectorCard({ sector, changed = false, onOpen, onOpenPage }) {
  const perf1m = Number(sector?.performance?.change_1m || 0);

  return (
    <div className={`card transition ${changed ? "ring-1 ring-primary/70" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white/90">{sector?.sector_name}</h3>
        <span className={`rounded border px-2 py-0.5 text-xs ${signalClass(sector?.signal)}`}>{sector?.signal || "HOLD"}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
        <p>Score</p>
        <p className="text-right font-mono text-white">{Number(sector?.composite_score || 0).toFixed(1)}</p>
        <p>1M</p>
        <p className={`text-right font-mono ${perf1m >= 0 ? "text-buy" : "text-sell"}`}>{formatPercent(perf1m)}</p>
        <p>Breadth</p>
        <p className="text-right font-mono">{Number(sector?.stocks_above_ma50_pct || 0).toFixed(1)}%</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={onOpen} className="rounded border border-white/20 px-2 py-1 text-xs hover:border-primary/60">
          View Details
        </button>
        <button
          type="button"
          onClick={() => onOpenPage?.()}
          className="text-xs text-primary hover:underline"
        >
          Open Page
        </button>
      </div>
    </div>
  );
}
