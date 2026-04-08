/** Animated SVG score gauge component for BUY/HOLD/SELL confidence. */

import { motion } from "framer-motion";

/**
 * Gauge for final recommendation score.
 * @param {{score:number, action:string}} props
 * @returns {JSX.Element}
 */
export default function ScoreGauge({ score = 0, action = "HOLD" }) {
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(score || 0)));
  const offset = circumference * (1 - pct / 100);

  const color = pct < 50 ? "#EF4444" : pct <= 75 ? "#F59E0B" : "#22C55E";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center"
    >
      <h3 className="mb-2 text-sm font-semibold text-white/80">Recommendation Score</h3>
      <svg width="220" height="140" viewBox="0 0 220 140">
        <path d="M20,120 A90,90 0 0,1 200,120" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="14" />
        <motion.path
          d="M20,120 A90,90 0 0,1 200,120"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1 }}
        />
        <text x="110" y="95" textAnchor="middle" className="fill-white font-mono text-3xl">
          {Math.round(pct)}
        </text>
        <text x="110" y="115" textAnchor="middle" className="fill-white/70 text-xs">
          {action}
        </text>
      </svg>
    </motion.div>
  );
}
