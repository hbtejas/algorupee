/** Holdings table with remove actions and P&L visualization. */

import { formatCurrency, formatPercent } from "../../utils/formatters";

/**
 * Portfolio table component.
 * @param {{rows:any[], onRemove:(id:string)=>void}} props
 * @returns {JSX.Element}
 */
export default function PortfolioTable({ rows = [], onRemove }) {
  return (
    <div className="card overflow-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-white/20 text-left text-xs uppercase tracking-wide text-white/60">
            <th className="py-2">Symbol</th>
            <th className="py-2">Qty</th>
            <th className="py-2">Buy Price</th>
            <th className="py-2">CMP</th>
            <th className="py-2">P&L</th>
            <th className="py-2">Change</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-white/10">
              <td className="py-3 font-mono text-primary">{row.symbol}</td>
              <td>{row.quantity}</td>
              <td>{formatCurrency(row.buyPrice)}</td>
              <td>{formatCurrency(row.cmp)}</td>
              <td className={row.pnl >= 0 ? "text-buy" : "text-sell"}>{formatCurrency(row.pnl)}</td>
              <td className={row.pnlPct >= 0 ? "text-buy" : "text-sell"}>{formatPercent(row.pnlPct)}</td>
              <td>
                <button type="button" className="rounded bg-sell/20 px-2 py-1 text-xs text-sell" onClick={() => onRemove(row.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-center text-sm text-white/60">No holdings yet.</p>}
    </div>
  );
}
