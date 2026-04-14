import React from 'react';

const pulseClass = "animate-pulse rounded bg-white/5";

/**
 * Animated gray bar 280px tall for charts.
 */
export const ChartSkeleton = () => (
  <div className={`${pulseClass} h-[280px] w-full`} />
);

/**
 * Table skeleton with N rows.
 */
export const TableSkeleton = ({ rows = 5 }) => (
  <div className="space-y-3">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className={`${pulseClass} h-12 w-full`} />
    ))}
  </div>
);

/**
 * Single card with 2 lines.
 */
export const CardSkeleton = () => (
  <div className="rounded-xl border border-white/10 bg-[#0f1729] p-4 space-y-3">
    <div className={`${pulseClass} h-4 w-1/3`} />
    <div className={`${pulseClass} h-6 w-1/2`} />
  </div>
);

/**
 * Generic Skeleton base for custom shapes.
 */
const Skeleton = ({ className }) => (
  <div className={`${pulseClass} ${className}`} />
);

export default Skeleton;
