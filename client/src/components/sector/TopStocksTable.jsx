import { Link } from "react-router-dom";
import { formatPercent } from "../../utils/formatters";

/**
 * Top stocks table in sector.
 * @param {{stocks:any[], loading:boolean, title?:string}} props
 * @returns {JSX.Element}
 */
export default function TopStocksTable({ stocks = [], loading = false, title = "Top Stocks" }) {
  return (
    <div className="card overflow-x-auto">
      <p className="mb-3 text-sm font-semibold text-white/80">{title}</p>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-white/60">
            <th className="pb-2">Symbol</th>
            <th className="pb-2 text-right">Score</th>
            <th className="pb-2 text-right">1D</th>
            <th className="pb-2 text-right">RSI</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="py-2 text-white/60">
                Loading top stocks...
              </td>
            </tr>
          )}
          {!loading && stocks.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-white/60">
                No stock data available.
              </td>
            </tr>
          )}
          {!loading &&
            stocks.map((stock) => (
              <tr key={stock?.symbol} className="border-t border-white/10">
                <td className="py-2 font-mono text-primary">
                  <Link to={`/stock/${stock?.symbol}`} className="hover:underline">
                    {stock?.symbol}
                  </Link>
                </td>
                <td className="py-2 text-right font-mono">{Number(stock?.score || 0).toFixed(1)}</td>
                <td className={`py-2 text-right font-mono ${Number(stock?.change_1d || 0) >= 0 ? "text-buy" : "text-sell"}`}>
                  {formatPercent(Number(stock?.change_1d || 0))}
                </td>
                <td className="py-2 text-right font-mono">{Number(stock?.rsi || 0).toFixed(1)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
