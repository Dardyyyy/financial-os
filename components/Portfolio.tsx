import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from "recharts";
import { Holding, loadHoldings, saveHoldings, eur, eur2, uid } from "../lib/store";

const palette = ["#3b82f6", "#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb7185"];

export default function Portfolio() {
  const [holds, setHolds] = useState<Holding[]>([]);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [buy, setBuy] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => { setHolds(loadHoldings()); }, []);

  const rows = useMemo(() => holds.map(h => {
    const value = h.shares * h.lastPrice;
    const cost = h.shares * h.buyPrice;
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { ...h, value, cost, pl, plPct };
  }), [holds]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const pieData = rows.map(r => ({ name: r.ticker, value: Math.round(r.value) }));

  const add = () => {
    const sh = parseFloat(shares.replace(",", "."));
    const bp = parseFloat(buy.replace(",", "."));
    const lp = parseFloat(last.replace(",", ".")) || bp;
    if (!ticker.trim() || isNaN(sh) || isNaN(bp)) return;
    const next = [...holds, {
      id: uid(), ticker: ticker.toUpperCase().trim(), name: name.trim() || ticker.toUpperCase().trim(),
      shares: sh, buyPrice: bp, lastPrice: lp,
    }];
    setHolds(next); saveHoldings(next);
    setTicker(""); setName(""); setShares(""); setBuy(""); setLast("");
  };

  const updatePrice = (id: string, price: number) => {
    const next = holds.map(h => h.id === id ? { ...h, lastPrice: price } : h);
    setHolds(next); saveHoldings(next);
  };

  const remove = (id: string) => {
    const next = holds.filter(h => h.id !== id);
    setHolds(next); saveHoldings(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-sm text-muted">Depotwert</div>
          <div className="text-2xl font-bold mt-1">{eur(totalValue)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Investiert</div>
          <div className="text-2xl font-bold mt-1 text-muted">{eur(totalCost)}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted">Gewinn / Verlust</div>
          <div className={`text-2xl font-bold mt-1 ${totalPL >= 0 ? "text-good" : "text-bad"}`}>
            {totalPL >= 0 ? "+" : ""}{eur(totalPL)} ({totalPLPct.toFixed(1)}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Holdings table */}
        <div className="card p-5">
          <div className="font-semibold mb-4">Positionen</div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} />
                  <div className="min-w-0">
                    <div className="font-semibold">{r.ticker}</div>
                    <div className="text-xs text-muted truncate">{r.name} · {r.shares} Stk</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    className="input w-24 text-right py-1"
                    defaultValue={r.lastPrice}
                    onBlur={e => updatePrice(r.id, parseFloat(e.target.value.replace(",", ".")) || r.lastPrice)}
                    title="Aktueller Kurs"
                  />
                  <div className="text-right w-28">
                    <div className="font-medium">{eur(r.value)}</div>
                    <div className={`text-xs ${r.pl >= 0 ? "text-good" : "text-bad"}`}>
                      {r.pl >= 0 ? "+" : ""}{r.plPct.toFixed(1)}%
                    </div>
                  </div>
                  <button onClick={() => remove(r.id)} className="text-muted hover:text-bad">✕</button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-muted text-sm">Noch keine Positionen.</div>}
          </div>

          {/* Add holding */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input className="input" placeholder="Ticker" value={ticker} onChange={e => setTicker(e.target.value)} />
            <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Stück" value={shares} onChange={e => setShares(e.target.value)} />
            <input className="input" placeholder="Kaufkurs" value={buy} onChange={e => setBuy(e.target.value)} />
            <input className="input" placeholder="Akt. Kurs" value={last} onChange={e => setLast(e.target.value)} />
          </div>
          <button className="btn mt-2 w-full" onClick={add}>Position hinzufügen</button>
        </div>

        {/* Allocation */}
        <div className="card p-5">
          <div className="font-semibold mb-2">Allokation</div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#121826", border: "1px solid #243049", borderRadius: 12 }}
                  formatter={(v: number) => eur2(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8b98b3" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted">
        Kurse trägst du aktuell manuell ein (Feld antippen → Wert → wegklicken). In Phase 2 kommt eine Live-Kurs-API dazu.
      </div>
    </div>
  );
}
