/** Volume and volume-ratio chart panel. */

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

/**
 * Volume chart component.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function VolumeChart({ data = [] }) {
  return (
    <div className="card h-56">
      <h3 className="mb-2 text-sm font-semibold text-white/80">Volume</h3>
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart data={data.slice(-120)}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="Volume" fill="rgba(96, 165, 250, 0.4)" />
          <Line yAxisId="right" dataKey="volume_ratio" dot={false} stroke="#00D4AA" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
