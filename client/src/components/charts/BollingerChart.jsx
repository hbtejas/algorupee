/** Bollinger Bands chart panel with close and upper/lower band lines. */

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

/**
 * Bollinger Bands chart component.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function BollingerChart({ data = [] }) {
  return (
    <div className="card h-56">
      <h3 className="mb-2 text-sm font-semibold text-white/80">Bollinger Bands</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data.slice(-120)}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip />
          <Line dataKey="Close" stroke="#00D4AA" dot={false} strokeWidth={2} />
          <Line dataKey="bb_upper" stroke="#60A5FA" dot={false} strokeDasharray="4 4" />
          <Line dataKey="bb_lower" stroke="#60A5FA" dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
