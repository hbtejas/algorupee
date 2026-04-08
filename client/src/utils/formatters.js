/** UI value formatters for currency, percentages, and dates. */

import { format } from "date-fns";

/**
 * Format number as INR currency.
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

/**
 * Format number as percent with sign.
 * @param {number} value
 * @returns {string}
 */
export function formatPercent(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Format date for display.
 * @param {string|Date} value
 * @returns {string}
 */
export function formatDate(value) {
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch (error) {
    return "-";
  }
}
