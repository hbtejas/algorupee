/** Persistent risk disclaimer banner for analysis-related pages. */

/**
 * Risk disclaimer banner.
 * @returns {JSX.Element}
 */
export default function RiskDisclaimer() {
  return (
    <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p>
        This tool is for educational purposes only. Predictions are probabilistic and not guaranteed. Past
        performance is not indicative of future results. Consult a SEBI-registered financial advisor before
        investing.
      </p>
    </div>
  );
}
