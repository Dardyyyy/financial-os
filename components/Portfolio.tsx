import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Holding, loadHoldings, saveHoldings, eur, eur2, uid } from "../lib/store";
import CountUp from "./CountUp";

const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24", "#34D399"];

export default function Portfolio() {
  const [holds, setHolds] = useState<Holding[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");

  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [buy, setBuy] = useState("");
  const [last, setLast] = useState("");
  const [kind, setKind] = useState<"stock" | "crypto">("stock");
  const [cgId, setCgId] = useState("");

  useEffect(() => { loadHoldings().then(h => { setHolds(h); setReady(true); }); }, []);

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

  const persist = (next: Holding[]) => { setHolds(next); saveHoldings(next); };

  const refreshPrices = async () => {
    setRefreshing(true); setNote("");
    try {
      const stockSyms = holds.filter(h => h.kind === "stock").map(h => h.ticker);
      const cryptoIds = holds.filter(h => h.kind === "crypto" && h.cgId).map(h => h.cgId!) as string[];

      const [stockRes, cryptoRes] = await Promise.all([
        stockSyms.length ? fetch(`/api/quote?type=stock&symbols=${stockSyms.join(",")}`).then(r => r.json()) : Promise.resolve({ prices: {} }),
        cryptoIds.length ? fetch(`/api/quote?type=crypto&ids=${cryptoIds.join(",")}`).then(r => r.json()) : Promise.resolve({ prices: {} }),
      ]);

      const next = holds.map(h => {
        if (h.kind === "stock" && stockRes.prices[h.ticker] != null) return { ...h, lastPrice: stockRes.prices[h.ticker] };
        if (h.kind === "crypto" && h.cgId && cryptoRes.prices[h.cgId] != null) return { ...h, lastPrice: cryptoRes.prices[h.cgId] };
        return h;
      });
      persist(next);
      if (stockRes.warning) setNote(stockRes.warning);
      else setNote(`Aktualisiert: ${new Date().toLocaleTimeString("de-DE")}`);
    } catch {
      setNote("Konnte Kurse nicht laden.");
    } finally { setRefreshing(false); }
  };

  const add = () => {
    const sh = parseFloat(shares.replace(",", "."));
    const bp = parseFloat(buy.replace(",", "."));
    const lp = parseFloat(last.replace(",", ".")) || bp;
    if (!ticker.trim() || isNaN(sh) || isNaN(bp)) return;
    persist([...holds, {
      id: uid(), ticker: ticker.toUpperCase().trim(), name: name.trim() || ticker.toUpperCase().trim(),
      shares: sh, buyPrice: bp, lastPrice: lp, kind, cgId: kind === "crypto" ? cgId.trim().toLowerCase() : undefined,
    }]);
    setTicker(""); setName(""); setShares(""); setBuy(""); setLast(""); setCgId("");
  };

  const remove = (id: string) => persist(holds.filter(h => h.id !== id));
  const updatePrice = (id: string, p: number) => persist(holds.map(h => h.id === id ? { ...h, lastPrice: p } : h));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-hl p-6">
          <div className="text-sm text-muted">Depotwert</div>
          <div className="display text-3xl font-bold mt-2 text-gold">{ready ? <CountUp value={totalValue} format={eur} /> : "—"}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted">Investiert</div>
          <div className="display text-2xl font-bold mt-2 text-muted">{ready ? <CountUp value={totalCost} format={eur} /> : "—"}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted">Gewinn / Verlust</div>
          <div className={`display text-2xl font-bold mt-2 ${totalPL >= 0 ? "text-mint" : "text-bad"}`}>
            {ready ? <CountUp value={totalPL} format={eur} /> : "—"}
            <span className="num text-base ml-2">({totalPLPct >= 0 ? "+" : ""}{totalPLPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" onClick={refreshPrices} disabled={refreshing}>
          {refreshing ? "Lädt Kurse…" : "↻ Live-Kurse aktualisieren"}
        </button>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="card p-6">
          <div className="font-semibold display mb-4">Positionen</div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/50 pb-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} />
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">{r.ticker}
                      {r.kind === "crypto" && <span className="text-[10px] text-mint border border-mint/40 rounded px-1">CRYPTO</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{r.name} · {r.shares} Stk</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input className="input num w-24 text-right py-1.5" defaultValue={r.lastPrice}
                    onBlur={e => updatePrice(r.id, parseFloat(e.target.value.replace(",", ".")) || r.lastPrice)} title="Aktueller Kurs" />
                  <div className="text-right w-28">
                    <div className="num font-medium">{eur(r.value)}</div>
                    <div className={`num text-xs ${r.pl >= 0 ? "text-mint" : "text-bad"}`}>{r.pl >= 0 ? "+" : ""}{r.plPct.toFixed(1)}%</div>
                  </div>
                  <button onClick={() => remove(r.id)} className="text-muted hover:text-bad opacity-0 group-hover:opacity-100 transition">✕</button>
                </div>
              </div>
            ))}
            {ready && rows.length === 0 && <div className="text-muted text-sm">Noch keine Positionen.</div>}
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setKind("stock")} className={`chip ${kind === "stock" ? "!text-gold border-gold" : ""}`}
                style={kind === "stock" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>Aktie</button>
              <button onClick={() => setKind("crypto")} className={`chip ${kind === "crypto" ? "border-mint" : ""}`}
                style={kind === "crypto" ? { borderColor: "#5EEAD4", color: "#5EEAD4" } : {}}>Krypto</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input className="input" placeholder="Ticker" value={ticker} onChange={e => setTicker(e.target.value)} />
              <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
              <input className="input num" placeholder="Stück" value={shares} onChange={e => setShares(e.target.value)} />
              <input className="input num" placeholder="Kaufkurs" value={buy} onChange={e => setBuy(e.target.value)} />
              <input className="input num" placeholder="Akt. Kurs" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            {kind === "crypto" && (
              <input className="input" placeholder="CoinGecko-ID (z.B. bitcoin) — für Live-Kurse" value={cgId} onChange={e => setCgId(e.target.value)} />
            )}
            <button className="btn w-full" onClick={add}>Position hinzufügen</button>
          </div>
        </div>

        <div className="card p-6">
          <div className="font-semibold display mb-2">Allokation</div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3} stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #26314D", borderRadius: 12, fontFamily: "var(--font-mono)" }} formatter={(v) => eur2(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8794B0" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted">
        Aktien-Kurse via Finnhub (braucht FINNHUB_API_KEY), Krypto via CoinGecko (CoinGecko-ID angeben). Ohne Key kannst du Kurse jederzeit manuell antippen und überschreiben.
      </div>
    </div>
  );
}
