import { useMemo } from "react";

/**
 * Side-by-side compare modal for selected sectors.
 * @param {{open:boolean, onClose:()=>void, comparison:any}} props
 * @returns {JSX.Element|null}
 */
export default function SectorCompareModal({ open, onClose, comparison }) {
  const entries = useMemo(() => Object.entries(comparison || {}), [comparison]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-xl border border-white/20 bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Sector Comparison</h3>
          <button type="button" onClick={onClose} className="rounded border border-white/20 px-2 py-1 text-xs hover:border-primary/60">
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {entries.map(([name, sector]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">{name}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-white/70">
                <p>Score</p>
                <p className="text-right font-mono">{Number(sector?.composite_score || 0).toFixed(1)}</p>
                <p>Momentum</p>
                <p className="text-right font-mono">{Number(sector?.momentum_score || 0).toFixed(1)}</p>
                <p>Breadth</p>
                <p className="text-right font-mono">{Number(sector?.breadth_score || 0).toFixed(1)}</p>
                <p>Valuation</p>
                <p className="text-right font-mono">{Number(sector?.valuation_score || 0).toFixed(1)}</p>
                <p>1M</p>
                <p className="text-right font-mono">{Number(sector?.performance?.change_1m || 0).toFixed(2)}%</p>
                <p>Signal</p>
                <p className="text-right font-mono">{sector?.signal || "HOLD"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
