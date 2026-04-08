import { formatPercent } from "../../utils/formatters";

function scoreClass(score) {
  if (score >= 70) return "from-emerald-500/60 to-emerald-700/70";
  if (score >= 55) return "from-amber-500/50 to-amber-700/60";
  return "from-rose-500/50 to-rose-700/60";
}

/**
 * Sector heatmap tile grid.
 * @param {{data:any[], onSelect:(name:string)=>void, selected?:string}} props
 * @returns {JSX.Element}
 */
export default function SectorHeatmap({ data = [], onSelect, selected = "" }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((sector) => {
        const isSelected = selected && selected === sector?.name;
        return (
          <button
            type="button"
            key={sector?.name}
            onClick={() => onSelect?.(sector?.name)}
            className={`rounded-xl border p-3 text-left transition ${isSelected ? "border-primary" : "border-white/10"} bg-gradient-to-br ${scoreClass(Number(sector?.composite_score || 0))}`}
          >
            <p className="text-sm font-semibold text-white">{sector?.name}</p>
            <p className="mt-2 text-xs text-white/80">1D: {formatPercent(Number(sector?.change_1d || 0))}</p>
            <p className="text-xs text-white/80">1M: {formatPercent(Number(sector?.change_1m || 0))}</p>
            <p className="mt-2 text-xs text-white/80">Score {Number(sector?.composite_score || 0).toFixed(1)}</p>
            <p className="text-[11px] text-white/70">Phase: {sector?.rotation_phase || "Neutral"}</p>
          </button>
        );
      })}
    </div>
  );
}
