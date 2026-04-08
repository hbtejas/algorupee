import { ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

function colorForSignal(signal) {
  if (signal === "BUY") return "#22c55e";
  if (signal === "AVOID") return "#f43f5e";
  return "#f59e0b";
}

/**
 * Bubble chart for sector rotation.
 * @param {{data:any[]}} props
 * @returns {JSX.Element}
 */
export default function SectorRotationChart({ data = [] }) {
  return (
    <div className="card h-[340px]">
      <p className="mb-3 text-sm font-semibold text-white/80">Sector Rotation Map</p>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 12, bottom: 22, left: 0 }}>
          <XAxis type="number" dataKey="x" name="Momentum" domain={[0, 100]} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Valuation" domain={[0, 100]} tick={{ fill: "#cbd5e1", fontSize: 11 }} />
          <ZAxis type="number" dataKey="size" range={[80, 900]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ background: "#0f1729", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 8 }}
            formatter={(value, name) => [Number(value).toFixed(2), name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || "Sector"}
          />
          {data.map((item) => (
            <Scatter key={item?.name} name={item?.name} data={[item]} fill={colorForSignal(item?.signal)} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
