/** Expandable explainability section for recommendation reasoning. */

import { useState } from "react";

/**
 * Explainability panel.
 * @param {{explainability:any}} props
 * @returns {JSX.Element}
 */
export default function ExplainabilityPanel({ explainability }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card">
      <button type="button" className="mb-3 flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <h3 className="text-sm font-semibold text-white/80">Why this recommendation?</h3>
        <span className="text-xs text-primary">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-buy">Positive Factors</p>
            <ul className="space-y-2 text-sm text-white/80">
              {(explainability?.top_positive_factors || []).map((item) => (
                <li key={item} className="rounded border border-buy/20 bg-buy/10 p-2">
                  ✓ {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sell">Negative Factors</p>
            <ul className="space-y-2 text-sm text-white/80">
              {(explainability?.top_negative_factors || []).map((item) => (
                <li key={item} className="rounded border border-sell/20 bg-sell/10 p-2">
                  ⚠ {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
        {(explainability?.risk_warnings || []).map((item) => (
          <p key={item} className="mb-1 last:mb-0">
            ⚠ {item}
          </p>
        ))}
      </div>
    </div>
  );
}
