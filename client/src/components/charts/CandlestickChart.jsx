/** Candlestick-like OHLC chart with technical overlays and period selector. */

import { useMemo, useState } from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Bar,
  Line,
} from "recharts";

const periods = ["1M", "3M", "6M", "1Y", "2Y"];

/**
 * Candlestick style chart component.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function CandlestickChart({ data = [] }) {
  const [period, setPeriod] = useState("6M");
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [showBB, setShowBB] = useState(true);

  const filtered = useMemo(() => {
    const map = { "1M": 22, "3M": 66, "6M": 132, "1Y": 252, "2Y": 504 };
    return data.slice(-map[period]);
  }, [data, period]);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/80">Price Action</h3>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button key={p} className={`rounded px-2 py-1 text-xs ${period === p ? "bg-primary text-black" : "bg-white/10"}`} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-white/70">
        <label><input type="checkbox" checked={showMA50} onChange={() => setShowMA50((v) => !v)} /> MA50</label>
        <label><input type="checkbox" checked={showMA200} onChange={() => setShowMA200((v) => !v)} /> MA200</label>
        <label><input type="checkbox" checked={showBB} onChange={() => setShowBB((v) => !v)} /> Bollinger</label>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#a3a3a3", fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#0f1729", border: "1px solid rgba(255,255,255,0.15)" }}
              formatter={(value, name) => [Number(value).toFixed(2), name]}
            />
            <Bar dataKey="Close" fill="rgba(0, 212, 170, 0.25)" />
            {showMA50 && <Line dataKey="ma_50" dot={false} stroke="#22C55E" strokeWidth={1.5} />}
            {showMA200 && <Line dataKey="ma_200" dot={false} stroke="#F59E0B" strokeWidth={1.5} />}
            {showBB && <Line dataKey="bb_upper" dot={false} stroke="#60A5FA" strokeDasharray="4 4" strokeWidth={1} />}
            {showBB && <Line dataKey="bb_lower" dot={false} stroke="#60A5FA" strokeDasharray="4 4" strokeWidth={1} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
