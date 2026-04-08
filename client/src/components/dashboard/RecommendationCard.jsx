/** Recommendation card with action badge, confidence bar, and risk level. */

/**
 * Recommendation details card.
 * @param {{recommendation:any}} props
 * @returns {JSX.Element}
 */
export default function RecommendationCard({ recommendation }) {
  const action = recommendation?.action || "HOLD";
  const color = action === "BUY" ? "bg-buy/20 text-buy" : action === "SELL" ? "bg-sell/20 text-sell" : "bg-hold/20 text-hold";
  const rawConfidence = Number(recommendation?.confidence ?? recommendation?.final_score ?? 50);
  const confidence = Math.max(0, Math.min(100, Number.isFinite(rawConfidence) ? rawConfidence : 50));

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">AI Recommendation</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${color}`}>{action}</span>
      </div>
      <p className="mb-2 text-sm text-white/70">Confidence: {confidence}%</p>
      <div className="h-2 overflow-hidden rounded bg-white/10">
        <div className="h-full rounded bg-primary" style={{ width: `${confidence}%` }} />
      </div>
      <p className="mt-3 text-xs text-white/70">Risk Level: {recommendation?.risk_level || "MEDIUM"}</p>
      <p className="mt-2 text-xs text-amber-300">Predictions are probabilistic and not guaranteed.</p>
    </div>
  );
}
