import { useEffect, useState } from "react";
import { Holding, loadHoldings } from "../lib/store";

export default function Ticker() {
  const [holds, setHolds] = useState<Holding[]>([]);
  useEffect(() => { loadHoldings().then(setHolds); }, []);

  if (!holds.length) return null;

  const items = holds.map(h => {
    const pct = h.buyPrice > 0 ? ((h.lastPrice - h.buyPrice) / h.buyPrice) * 100 : 0;
    return { ticker: h.ticker, price: h.lastPrice, pct };
  });
  // verdoppeln fuer nahtlose Endlosschleife
  const loop = [...items, ...items];

  return (
    <div className="ticker-wrap overflow-hidden border-y border-line/60 bg-ink/40">
      <div className="ticker-track py-2.5 text-sm whitespace-nowrap">
        {loop.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="font-semibold tracking-wide">{it.ticker}</span>
            <span className="num text-muted">{it.price.toFixed(2)}</span>
            <span className={`num ${it.pct >= 0 ? "text-mint" : "text-bad"}`}>
              {it.pct >= 0 ? "▲" : "▼"} {Math.abs(it.pct).toFixed(1)}%
            </span>
            <span className="text-line">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
