/** Alert manager component for create/list/delete alert rules. */

import { useEffect, useState } from "react";
import { alertsApi, getApiError } from "../../utils/api";
import LoadingSpinner from "../shared/LoadingSpinner";

const types = ["PRICE_ABOVE", "PRICE_BELOW", "SCORE_BUY", "SCORE_SELL"];

/**
 * Alert manager UI.
 * @returns {JSX.Element}
 */
export default function AlertManager() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ symbol: "INFY", type: "PRICE_ABOVE", threshold: 1800 });

  /** Load all alerts from API. */
  async function loadAlerts() {
    setLoading(true);
    setError("");
    try {
      const { data } = await alertsApi.list();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  /**
   * Create new alert.
   * @param {import('react').FormEvent} e
   */
  async function onCreate(e) {
    e.preventDefault();
    try {
      await alertsApi.create(form);
      await loadAlerts();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  /**
   * Delete alert by id.
   * @param {string} id
   */
  async function onDelete(id) {
    try {
      await alertsApi.remove(id);
      await loadAlerts();
    } catch (err) {
      setError(getApiError(err));
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="card grid gap-3 md:grid-cols-4">
        <input
          value={form.symbol}
          onChange={(e) => setForm((s) => ({ ...s, symbol: e.target.value.toUpperCase() }))}
          className="rounded border border-white/20 bg-white/5 px-3 py-2"
          placeholder="Symbol"
          required
        />
        <select
          value={form.type}
          onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
          className="rounded border border-white/20 bg-white/5 px-3 py-2"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={form.threshold}
          onChange={(e) => setForm((s) => ({ ...s, threshold: Number(e.target.value) }))}
          className="rounded border border-white/20 bg-white/5 px-3 py-2"
          required
        />
        <button type="submit" className="rounded bg-primary px-3 py-2 font-semibold text-black">
          Create Alert
        </button>
      </form>

      {error && <p className="text-sm text-sell">{error}</p>}

      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/20 text-left text-xs uppercase tracking-wide text-white/60">
              <th className="py-2">Symbol</th>
              <th className="py-2">Type</th>
              <th className="py-2">Threshold</th>
              <th className="py-2">Active</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id} className="border-b border-white/10">
                <td className="py-2 font-mono text-primary">{a.symbol}</td>
                <td>{a.alertType}</td>
                <td>{a.threshold}</td>
                <td>{a.active ? "Yes" : "No"}</td>
                <td>
                  <button type="button" className="rounded bg-sell/20 px-2 py-1 text-xs text-sell" onClick={() => onDelete(a._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && <p className="py-8 text-center text-sm text-white/60">No alerts configured.</p>}
      </div>
    </div>
  );
}
