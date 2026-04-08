/** RSI line chart with overbought/oversold reference levels. */

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from "recharts";

/**
 * RSI chart component.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function RSIChart({ data = [] }) {
  return (
    <div className="card h-56">
      <h3 className="mb-2 text-sm font-semibold text-white/80">RSI (14)</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data.slice(-120)}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 4" />
          <ReferenceLine y={30} stroke="#22C55E" strokeDasharray="4 4" />
          <Tooltip />
          <Line dataKey="rsi" stroke="#00D4AA" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
