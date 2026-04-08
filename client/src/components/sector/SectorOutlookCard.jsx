/**
 * Narrative outlook block for selected sector.
 * @param {{sector:any}} props
 * @returns {JSX.Element|null}
 */
export default function SectorOutlookCard({ sector }) {
  if (!sector) return null;

  return (
    <div className="card">
      <p className="mb-2 text-sm font-semibold text-white/80">Outlook</p>
      <p className="text-sm leading-relaxed text-white/75">{sector?.outlook || "No outlook available."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
        <p>Trend</p>
        <p className="text-right">{sector?.trend || "NEUTRAL"}</p>
        <p>Rotation</p>
        <p className="text-right">{sector?.rotation_phase || "Neutral"}</p>
      </div>
    </div>
  );
}
