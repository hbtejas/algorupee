/** News sentiment feed with color-coded article cards. */

import { formatDate } from "../../utils/formatters";

/**
 * Sentiment feed component.
 * @param {{sentiment:any}} props
 * @returns {JSX.Element}
 */
export default function SentimentFeed({ sentiment }) {
  const items = sentiment?.recent_articles || [];

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">Latest Company News (Sentiment Feed)</h3>
        <span className="rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/60">
          Score: {sentiment?.score ?? "-"}/100
        </span>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-white/60">No recent articles available.</p>}
        {items.map((item) => {
          const border = item.sentiment === "POSITIVE" ? "border-buy" : item.sentiment === "NEGATIVE" ? "border-sell" : "border-hold";
          return (
            <a
              key={`${item.url}-${item.title}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className={`block rounded-lg border-l-4 ${border} bg-white/5 p-3 hover:bg-white/10`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                <span>{item.source}</span>
                <span>{formatDate(item.published_at)} • {item.sentiment}</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
