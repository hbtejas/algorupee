import React from 'react';
import { useHealth } from '../../context/HealthContext';

export default function HealthBanner() {
  const { online, checking, retry } = useHealth();

  if (online) return null;

  return (
    <div className="sticky top-0 z-[50] flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c.115-.24.334-.438.595-.53.26-.091.565-.03.765.17l8.25 8.25c.241.24.332.585.233.91-.098.324-.363.567-.698.636l-8.25 1.65a.75.75 0 01-.89-.893l1.65-8.25c.069-.335.312-.6.636-.698a.75.75 0 01.91.233l8.25 8.25a.75.75 0 11-1.06 1.06l-8.25-8.25-1.65 8.25a.75.75 0 11-1.47-.294l1.65-8.25z"
            clipRule="evenodd"
          />
          <path d="M10.788 3.102c.495-1.003 1.926-1.003 2.421 0l6.813 13.79c.47 0.951-.218 2.108-1.21 2.108H5.188c-0.992 0-1.68-1.157-1.21-2.108l6.81-13.79zM12 9a.75.75 0 00-.75.75v3.5a.75.75 0 001.5 0v-3.5A.75.75 0 0012 9zm0 7.5a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        <span>Live data unavailable — backend is offline. Some features are disabled.</span>
      </div>
      <button
        onClick={retry}
        disabled={checking}
        className="rounded bg-black/10 px-3 py-1 text-xs hover:bg-black/20 disabled:opacity-50"
      >
        {checking ? "Checking..." : "Retry"}
      </button>
    </div>
  );
}
