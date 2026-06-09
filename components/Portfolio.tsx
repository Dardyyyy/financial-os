import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Holding, loadHoldings, saveHoldings, getUsdEur, eur, eur2, usd, uid } from "../lib/store";
import CountUp from "./CountUp";

const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24", "#34D399"];

export default function Portfolio() {
  const [holds, setHolds] = useState<Holding[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const [fx, setFx] = useState(0.92);

  // Suche
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  // Auswahl + Eingaben
  const [picked, setPicked] = useState<{ ticker: string; name: string } | null>(null);
  const [shares, setShares] = useState("");
  const [buy, setBuy] = useState("");
  const [curr, setCurr] = useState<"USD" | "EUR">("USD");
  // Krypto
  const [cryptoMode, setCryptoMode] = useState(false);
  const [cTicker, setCTicker] = useState("");
  const [cgId, setCgId] = useState("");

  useEffect(() => { loadHoldings().then(h => { setHolds(h); setReady(true); }); getUsdEur().then(setFx); }, []);

  const toEur = (a: number, c: "USD" | "EUR") => (c === "USD" ? a * fx : a);
  const rows = useMemo(() => holds.map(h => {
    const valueEur = toEur(h.shares * h.lastPrice, h.currency);
    const costEur = toEur(h.shares * h.buyPrice, h.currency);
    const pl = valueEur - costEur;
    return { ...h, valueEur, pl, plPct: costEur > 0 ? (pl / costEur) * 100 : 0 };
  }), [holds, fx]);

  const totalValue = rows.reduce((s, r) => s + r.valueEur, 0);
  const totalCost = rows.reduce((s, r) => s + (r.currency === "USD" ? r.shares * r.buyPrice * fx : r.shares * r.buyPrice), 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const pieData = rows.map(r => ({ name: r.ticker, value: Math.round(r.valueEur) }));

  const persist = (n: Holding[]) => { setHolds(n); saveHoldings(n); };

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true); setSearchMsg("");
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`).then(x => x.json());
      const list = r.results || [];
      setResults(list);
      if (r.warning) setSearchMsg(r.warning);
      else if (list.length === 0) setSearchMsg(`Keine Treffer für \u201E${q.trim()}\u201C.`);
    } catch { setResults([]); setSearchMsg("Suche nicht erreichbar \u2014 ist die neue Version deployed?"); }
    finally { setSearching(false); }
  };

  const refreshPrices = async () => {
    setRefreshing(true); setNote("");
    try {
      const rate = await getUsdEur(); setFx(rate);
      const syms = holds.filter(h => h.kind === "stock").map(h => h.ticker);
      const ids = holds.filter(h => h.kind === "crypto" && h.cgId).map(h => h.cgId!) as string[];
      const [s, c] = await Promise.all([
        syms.length ? fetch(`/api/quote?type=stock&symbols=${syms.join(",")}`).then(r => r.json()) : Promise.resolve({ prices: {} }),
        ids.length ? fetch(`/api/quote?type=crypto&ids=${ids.join(",")}`).then(r => r.json()) : Promise.resolve({ prices: {} }),
      ]);
      persist(holds.map(h => {
        if (h.kind === "stock" && s.prices[h.ticker] != null) return { ...h, lastPrice: s.prices[h.ticker], currency: "USD" as const };
        if (h.kind === "crypto" && h.cgId && c.prices[h.cgId] != null) return { ...h, lastPrice: c.prices[h.cgId], currency: "EUR" as const };
        return h;
      }));
      setNote(`Aktualisiert ${new Date().toLocaleTimeString("de-DE")} · 1 USD = ${rate.toFixed(3)} EUR`);
    } catch { setNote("Konnte Kurse nicht laden."); } finally { setRefreshing(false); }
  };

  const addStock = () => {
    const sh = parseFloat(shares.replace(",", ".")); const bp = parseFloat(buy.replace(",", "."));
    if (!picked || isNaN(sh) || isNaN(bp)) return;
    persist([...holds, { id: uid(), ticker: picked.ticker, name: picked.name, shares: sh, buyPrice: bp, lastPrice: bp, kind: "stock", currency: curr }]);
    setPicked(null); setQ(""); setResults([]); setShares(""); setBuy("");
  };
  const addCrypto = () => {
    const sh = parseFloat(shares.replace(",", ".")); const bp = parseFloat(buy.replace(",", "."));
    if (!cTicker.trim() || isNaN(sh) || isNaN(bp)) return;
    persist([...holds, { id: uid(), ticker: cTicker.toUpperCase().trim(), name: cTicker.toUpperCase().trim(), shares: sh, buyPrice: bp, lastPrice: bp, kind: "crypto", currency: "EUR", cgId: cgId.trim().toLowerCase() }]);
    setCTicker(""); setCgId(""); setShares(""); setBuy("");
  };
  const remove = (id: string) => persist(holds.filter(h => h.id !== id));
  const updatePrice = (id: string, p: number) => persist(holds.map(h => h.id === id ? { ...h, lastPrice: p } : h));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-hl p-6"><div className="text-sm text-muted">Depotwert</div><div className="display text-3xl font-bold mt-2 text-gold">{ready ? <CountUp value={totalValue} format={eur} /> : "—"}</div></div>
        <div className="card p-6"><div className="text-sm text-muted">Investiert</div><div className="display text-2xl font-bold mt-2 text-muted">{ready ? <CountUp value={totalCost} format={eur} /> : "—"}</div></div>
        <div className="card p-6"><div className="text-sm text-muted">Gewinn / Verlust</div><div className={`display text-2xl font-bold mt-2 ${totalPL >= 0 ? "text-mint" : "text-bad"}`}>{ready ? <CountUp value={totalPL} format={eur} /> : "—"}<span className="num text-base ml-2">({totalPLPct >= 0 ? "+" : ""}{totalPLPct.toFixed(1)}%)</span></div></div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" onClick={refreshPrices} disabled={refreshing}>{refreshing ? "Lädt Kurse…" : "↻ Live-Kurse aktualisieren"}</button>
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
                      <span className="text-[10px] text-muted border border-line rounded px-1">{r.currency}</span>
                      {r.kind === "crypto" && <span className="text-[10px] text-mint border border-mint/40 rounded px-1">CRYPTO</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{r.name} · {r.shares} Stk</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input className="input num w-24 text-right py-1.5" defaultValue={r.lastPrice} onBlur={e => updatePrice(r.id, parseFloat(e.target.value.replace(",", ".")) || r.lastPrice)} />
                  <div className="text-right w-28"><div className="num font-medium">{eur(r.valueEur)}</div><div className={`num text-xs ${r.pl >= 0 ? "text-mint" : "text-bad"}`}>{r.pl >= 0 ? "+" : ""}{r.plPct.toFixed(1)}%</div></div>
                  <button onClick={() => remove(r.id)} className="text-muted hover:text-bad transition">✕</button>
                </div>
              </div>
            ))}
            {ready && rows.length === 0 && <div className="text-muted text-sm">Noch keine Positionen.</div>}
          </div>

          {/* Hinzufuegen */}
          <div className="mt-6 border-t border-line/50 pt-5 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setCryptoMode(false)} className="chip" style={!cryptoMode ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>Aktie suchen</button>
              <button onClick={() => setCryptoMode(true)} className="chip" style={cryptoMode ? { borderColor: "#5EEAD4", color: "#5EEAD4" } : {}}>Krypto</button>
            </div>

            {!cryptoMode ? (
              <>
                {!picked ? (
                  <>
                    <div className="flex gap-2">
                      <input className="input" placeholder="Name oder Ticker suchen (z.B. Nvidia)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} />
                      <button className="btn-ghost px-4 rounded-xl" onClick={doSearch} disabled={searching}>{searching ? "…" : "Suchen"}</button>
                    </div>
                    {searchMsg && <div className="text-xs text-muted">{searchMsg}</div>}
                    {results.length > 0 && (
                      <div className="border border-line rounded-xl divide-y divide-line/50 max-h-56 overflow-y-auto">
                        {results.map(r => (
                          <button key={r.symbol} onClick={() => { setPicked({ ticker: r.symbol, name: r.name }); setCurr("USD"); }} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between">
                            <span className="text-sm truncate">{r.name}</span>
                            <span className="num text-xs text-gold ml-2">{r.symbol}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-panel2/60 border border-line rounded-xl px-3 py-2">
                      <div><span className="font-semibold">{picked.ticker}</span> <span className="text-xs text-muted">{picked.name}</span></div>
                      <button onClick={() => setPicked(null)} className="text-muted hover:text-bad text-sm">ändern ✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input num" placeholder="Stück" value={shares} onChange={e => setShares(e.target.value)} />
                      <input className="input num" placeholder="Kaufkurs" value={buy} onChange={e => setBuy(e.target.value)} />
                      <select className="input" value={curr} onChange={e => setCurr(e.target.value as "USD" | "EUR")}><option value="USD">USD</option><option value="EUR">EUR</option></select>
                    </div>
                    <button className="btn w-full" onClick={addStock}>Position hinzufügen</button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Symbol (z.B. BTC)" value={cTicker} onChange={e => setCTicker(e.target.value)} />
                <input className="input" placeholder="CoinGecko-ID (bitcoin)" value={cgId} onChange={e => setCgId(e.target.value)} />
                <input className="input num" placeholder="Stück" value={shares} onChange={e => setShares(e.target.value)} />
                <input className="input num" placeholder="Kaufkurs (EUR)" value={buy} onChange={e => setBuy(e.target.value)} />
                <button className="btn col-span-2" onClick={addCrypto}>Krypto hinzufügen</button>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="font-semibold display mb-2">Allokation</div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3} stroke="none">{pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie>
                <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v) => [eur2(Number(v)), "Wert"]} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8794B0" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
