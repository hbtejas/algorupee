/** Portfolio allocation pie chart and total P&L summary chart. */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "../../utils/formatters";

const palette = ["#00D4AA", "#22C55E", "#60A5FA", "#F59E0B", "#EF4444", "#A78BFA"];

/**
 * Portfolio chart card.
 * @param {{rows:any[], summary:any}} props
 * @returns {JSX.Element}
 */
export default function PortfolioChart({ rows = [], summary }) {
  const chartData = rows.map((r) => ({ name: r.symbol, value: r.value }));

  return (
    <div className="card h-[340px]">
      <h3 className="mb-2 text-sm font-semibold text-white/80">Portfolio Allocation</h3>
      <p className="mb-2 text-xs text-white/60">Total Value: {formatCurrency(summary?.totalValue || 0)}</p>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={56}>
            {chartData.map((_, idx) => (
              <Cell key={String(idx)} fill={palette[idx % palette.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(v)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
