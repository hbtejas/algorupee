import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

/**
 * Radar chart for a sector score breakdown.
 * @param {{sector:any}} props
 * @returns {JSX.Element|null}
 */
export default function SectorScoreRadar({ sector }) {
  if (!sector) return null;

  const data = [
    { metric: "Momentum", value: Number(sector?.momentum_score || 0) },
    { metric: "Breadth", value: Number(sector?.breadth_score || 0) },
    { metric: "Valuation", value: Number(sector?.valuation_score || 0) },
    { metric: "Strength", value: Number(sector?.strength_score || 0) },
    { metric: "Composite", value: Number(sector?.composite_score || 0) },
  ];

  return (
    <div className="card h-[280px]">
      <p className="mb-2 text-sm font-semibold text-white/80">Score Radar</p>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="rgba(203,213,225,0.25)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
          <Radar name="Score" dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.4} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
