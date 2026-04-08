/** Displays weighted component scores behind final recommendation. */

/**
 * Score breakdown panel.
 * @param {{scores:any}} props
 * @returns {JSX.Element}
 */
export default function ScoreBreakdown({ scores }) {
  const rows = [
    { key: "fundamental", label: "Fundamental" },
    { key: "technical", label: "Technical" },
    { key: "sentiment", label: "Sentiment" },
    { key: "volume", label: "Volume" },
  ];

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-white/80">Score Breakdown</h3>
      <div className="space-y-2">
        {rows.map((row) => {
          const score = Number(scores?.[row.key]?.score || 0);
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                <span>{row.label}</span>
                <span className="font-mono">{score.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded bg-white/10">
                <div className="h-full rounded bg-primary/80" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
