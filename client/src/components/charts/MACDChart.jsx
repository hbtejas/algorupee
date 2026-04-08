/** MACD chart showing MACD line, signal line, and histogram bars. */

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

/**
 * MACD chart component.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function MACDChart({ data = [] }) {
  return (
    <div className="card h-56">
      <h3 className="mb-2 text-sm font-semibold text-white/80">MACD</h3>
      <ResponsiveContainer width="100%" height="85%">
        <ComposedChart data={data.slice(-120)}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="macd_histogram" fill="rgba(0, 212, 170, 0.35)" />
          <Line dataKey="macd" dot={false} stroke="#22C55E" strokeWidth={1.8} />
          <Line dataKey="macd_signal" dot={false} stroke="#F59E0B" strokeWidth={1.8} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
