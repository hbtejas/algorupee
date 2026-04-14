import { useEffect, useState } from "react";
import { analysisApi } from "../../utils/api";
import { useHealth } from "../../context/HealthContext";

// ... (defaults)

/**
 * Search input component.
 * @param {{onSelect: (item:any) => void}} props
 * @returns {JSX.Element}
 */
export default function SearchBar({ onSelect }) {
  const { online } = useHealth();
  // ... (states)

  // ... (submitSearch)

  // ... (useEffect)

  return (
    <div className="relative w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* ... (input) */}
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
