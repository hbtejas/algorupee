/** Debounced stock symbol search bar with default Indian stock suggestions. */

import { useEffect, useState } from "react";
import { analysisApi } from "../../utils/api";
import { useHealth } from "../../context/HealthContext";

const defaults = [
  { symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", current_price: 0 },
  { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NSE", current_price: 0 },
  { symbol: "INFY", name: "Infosys Limited", exchange: "NSE", current_price: 0 },
  { symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NSE", current_price: 0 },
  { symbol: "ICICIBANK", name: "ICICI Bank", exchange: "NSE", current_price: 0 },
  { symbol: "WIPRO", name: "Wipro", exchange: "NSE", current_price: 0 },
  { symbol: "LT", name: "Larsen & Toubro", exchange: "NSE", current_price: 0 },
  { symbol: "ASIANPAINT", name: "Asian Paints", exchange: "NSE", current_price: 0 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", exchange: "NSE", current_price: 0 },
  { symbol: "SBIN", name: "State Bank of India", exchange: "NSE", current_price: 0 },
];

/**
 * Search input component.
 * @param {{onSelect: (item:any) => void}} props
 * @returns {JSX.Element}
 */
export default function SearchBar({ onSelect }) {
  const { online } = useHealth();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(defaults);
  const [open, setOpen] = useState(false);

  /**
   * Trigger selection from query text for quick analyze flow.
   */
  function submitSearch() {
    const normalized = String(query || "").trim().toUpperCase();
    if (!normalized) {
      return;
    }

    const exact = items.find((item) => String(item.symbol).toUpperCase() === normalized);
    const isLikelySymbol = /^[A-Z0-9&.-]{1,20}$/.test(normalized) && !normalized.includes(" ");
    const picked = exact || (!isLikelySymbol && items.length ? items[0] : { symbol: normalized, name: normalized, exchange: "NSE" });
    onSelect(picked);
    setOpen(false);
  }

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setItems(defaults);
      return () => {};
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await analysisApi.search(normalized);
        if (!active) {
          return;
        }
        setItems(data?.length ? data : defaults);
      } catch (error) {
        if (!active) {
          return;
        }
        setItems(defaults);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitSearch();
            }
          }}
          placeholder="Search Indian stocks: INFY, TCS, RELIANCE..."
          className="w-full rounded-lg border border-white/20 bg-surface px-4 py-3 text-sm outline-none ring-primary/40 focus:ring"
        />
        <button
          type="button"
          onClick={submitSearch}
          disabled={!online}
          title={online ? "" : "Backend offline"}
          className={`w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-black hover:bg-[#00c19a] sm:w-auto ${!online ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          Search & Analyze
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[60vh] overflow-auto rounded-lg border border-white/10 bg-[#0f1729] shadow-xl">
          {items.map((item) => (
            <button
              key={item.symbol}
              type="button"
              className="flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left hover:bg-white/5"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              <div>
                <p className="font-semibold text-primary">{item.symbol}</p>
                <p className="text-xs text-white/70">{item.name}</p>
              </div>
              <div className="text-right text-xs text-white/70">
                <p>{item.exchange || "NSE"}</p>
                <p className="font-mono">₹{Number(item.current_price || 0).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
