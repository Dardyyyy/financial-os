import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Holding, Currency, loadHoldings, saveHoldings, getFxMap, loadSettings, saveSettings, fmt, fmt2, usd, uid, convertCur } from "../lib/store";
import CountUp from "./CountUp";
import CurrencySelect from "./CurrencySelect";

const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24", "#34D399"];
type Result = { symbol: string; name: string; cgId?: string; rank?: number | null };

export default function Portfolio() {
  const [holds, setHolds] = useState<Holding[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const [fxMap, setFxMap] = useState<Record<string, number>>({ EUR: 1, USD: 0.92, CHF: 1.05 });
  const [main, setMain] = useState<Currency>("CHF");

  const [cryptoMode, setCryptoMode] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [picked, setPicked] = useState<Result | null>(null);
  const [priceMsg, setPriceMsg] = useState("");
  const [shares, setShares] = useState("");
  const [buy, setBuy] = useState("");
  const [curr, setCurr] = useState<Currency>("USD");
  const tmr = useRef<any>(null);

  useEffect(() => { loadHoldings().then(h => { setHolds(h); setReady(true); }); getFxMap(["USD", "EUR", "CHF"]).then(setFxMap); loadSettings().then(st => setMain(st.mainCurrency)); }, []);

  // Live-Suche (debounced) – kein Button noetig
  useEffect(() => {
    if (picked) return;
    if (tmr.current) clearTimeout(tmr.current);
    const term = q.trim();
    if (term.length < 1) { setResults([]); setSearchMsg(""); setSearching(false); return; }
    setSearching(true);
    tmr.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}${cryptoMode ? "&type=crypto" : ""}`).then(x => x.json());
        const list: Result[] = r.results || [];
        setResults(list);
        setSearchMsg(r.warning ? r.warning : (list.length === 0 ? `Keine Treffer fuer "${term}".` : ""));
      } catch { setResults([]); setSearchMsg("Suche nicht erreichbar."); }
      finally { setSearching(false); }
    }, 350);
    return () => { if (tmr.current) clearTimeout(tmr.current); };
  }, [q, cryptoMode, picked]);

  const toMain = (a: number, c: Currency) => convertCur(a, c, main, fxMap);
  const rows = useMemo(() => holds.map(h => {
    const valueMain = toMain(h.shares * h.lastPrice, h.currency);
    const costMain = toMain(h.shares * h.buyPrice, h.currency);
    const pl = valueMain - costMain;
    return { ...h, valueMain, costMain, pl, plPct: costMain > 0 ? (pl / costMain) * 100 : 0 };
  }), [holds, fxMap, main]);

  const totalValue = rows.reduce((s, r) => s + r.valueMain, 0);
  const totalCost = rows.reduce((s, r) => s + r.costMain, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const pieData = rows.map(r => ({ name: r.ticker, value: Math.round(r.valueMain) }));
  const persist = (n: Holding[]) => { setHolds(n); saveHoldings(n); };
  const changeMain = (c: Currency) => { setMain(c); saveSettings({ mainCurrency: c }); };

  const switchMode = (crypto: boolean) => { setCryptoMode(crypto); setPicked(null); setResults([]); setQ(""); setSearchMsg(""); setPriceMsg(""); setBuy(""); setCurr(crypto ? "EUR" : "USD"); };

  // Auswahl -> aktuellen Kurs automatisch als Kaufkurs uebernehmen
  const pickResult = async (r: Result) => {
    setPicked(r); setResults([]); setBuy(""); setPriceMsg("Aktueller Kurs wird geladen ...");
    try {
      if (cryptoMode && r.cgId) {
        const d = await fetch(`/api/quote?type=crypto&ids=${r.cgId}`).then(x => x.json());
        const p = d.prices?.[r.cgId];
        if (p != null) { setBuy(String(p)); setPriceMsg(`Aktueller Kurs ${fmt2(p, "EUR")} - uebernommen`); }
        else setPriceMsg(d.warning || "Kein Live-Kurs - Kaufkurs bitte selbst eintragen.");
      } else {
        const d = await fetch(`/api/quote?type=stock&symbols=${encodeURIComponent(r.symbol)}`).then(x => x.json());
        const p = d.prices?.[r.symbol];
        if (p != null) { setCurr("USD"); setBuy(String(p)); setPriceMsg(`Aktueller Kurs ${usd(p)} - uebernommen`); }
        else setPriceMsg(d.warning || "Kein Live-Kurs - Kaufkurs bitte selbst eintragen.");
      }
    } catch { setPriceMsg("Kurs konnte nicht geladen werden - Kaufkurs bitte selbst eintragen."); }
  };
  const unpick = () => { setPicked(null); setPriceMsg(""); setBuy(""); setShares(""); };

  const refreshPrices = async () => {
    setRefreshing(true); setNote("");
    try {
      const fm = await getFxMap(["USD", "EUR", "CHF"]); setFxMap(fm);
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
      setNote(s.warning ? s.warning : `Aktualisiert ${new Date().toLocaleTimeString("de-DE")} - Anzeige in ${main}`);
    } catch { setNote("Konnte Kurse nicht laden."); } finally { setRefreshing(false); }
  };

  const addPosition = () => {
    const sh = parseFloat(shares.replace(",", ".")); const bp = parseFloat(buy.replace(",", "."));
    if (!picked || isNaN(sh) || isNaN(bp)) return;
    persist([...holds, {
      id: uid(), ticker: picked.symbol, name: picked.name, shares: sh, buyPrice: bp, lastPrice: bp,
      kind: cryptoMode ? "crypto" : "stock", currency: cryptoMode ? "EUR" : curr,
      cgId: cryptoMode ? picked.cgId : undefined,
    }]);
    setPicked(null); setQ(""); setResults([]); setShares(""); setBuy(""); setSearchMsg(""); setPriceMsg("");
  };

  const remove = (id: string) => persist(holds.filter(h => h.id !== id));
  const updatePrice = (id: string, p: number) => persist(holds.map(h => h.id === id ? { ...h, lastPrice: p } : h));

  const accent = cryptoMode ? "#5EEAD4" : "#F5B544";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <CurrencySelect value={main} onChange={changeMain} label="Anzeige in" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card card-hl p-6"><div className="text-sm text-muted">Depotwert</div><div className="display text-3xl font-bold mt-2 text-gold">{ready ? <CountUp value={totalValue} format={(n: number) => fmt(n, main)} /> : "..."}</div></div>
        <div className="card p-6"><div className="text-sm text-muted">Investiert</div><div className="display text-2xl font-bold mt-2 text-muted">{ready ? <CountUp value={totalCost} format={(n: number) => fmt(n, main)} /> : "..."}</div></div>
        <div className="card p-6"><div className="text-sm text-muted">Gewinn / Verlust</div><div className={`display text-2xl font-bold mt-2 ${totalPL >= 0 ? "text-mint" : "text-bad"}`}>{ready ? <CountUp value={totalPL} format={(n: number) => fmt(n, main)} /> : "..."}<span className="num text-base ml-2">({totalPLPct >= 0 ? "+" : ""}{totalPLPct.toFixed(1)}%)</span></div></div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" onClick={refreshPrices} disabled={refreshing}>{refreshing ? "Laedt Kurse ..." : "↻ Live-Kurse aktualisieren"}</button>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="card p-6">
          <div className="font-semibold display mb-4">Positionen</div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/50 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} />
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">{r.ticker}
                      <span className="text-[10px] text-muted border border-line rounded px-1">{r.currency}</span>
                      {r.kind === "crypto" && <span className="text-[10px] text-mint border border-mint/40 rounded px-1">CRYPTO</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{r.name} - {r.shares} Stk</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input className="input num w-24 text-right py-1.5" defaultValue={r.lastPrice} onBlur={e => updatePrice(r.id, parseFloat(e.target.value.replace(",", ".")) || r.lastPrice)} />
                  <div className="text-right w-28"><div className="num font-medium">{fmt(r.valueMain, main)}</div><div className={`num text-xs ${r.pl >= 0 ? "text-mint" : "text-bad"}`}>{r.pl >= 0 ? "+" : ""}{r.plPct.toFixed(1)}%</div></div>
                  <button onClick={() => remove(r.id)} className="x-btn">✕</button>
                </div>
              </div>
            ))}
            {ready && rows.length === 0 && <div className="text-muted text-sm">Noch keine Positionen.</div>}
          </div>

          {/* ===== Suche / Hinzufuegen ===== */}
          <div className="mt-6 border-t border-line/50 pt-5">
            {/* Segmented Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-panel2/60 border border-line mb-3">
              <button onClick={() => switchMode(false)} className="px-4 py-1.5 rounded-lg text-sm font-semibold transition" style={!cryptoMode ? { background: "#F5B544", color: "#0B1020" } : { color: "#8794B0" }}>{"📈"} Aktien</button>
              <button onClick={() => switchMode(true)} className="px-4 py-1.5 rounded-lg text-sm font-semibold transition" style={cryptoMode ? { background: "#5EEAD4", color: "#0B1020" } : { color: "#8794B0" }}>{"🪙"} Krypto</button>
            </div>

            {!picked ? (
              <div className="relative">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{"🔍"}</span>
                  <input autoFocus className="input pl-9 text-base" placeholder={cryptoMode ? "Coin suchen, z.B. Bitcoin, Solana ..." : "Aktie suchen, z.B. Nvidia, Apple ..."} value={q} onChange={e => setQ(e.target.value)} />
                  {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">sucht ...</span>}
                </div>
                {searchMsg && <div className="text-xs text-muted mt-2">{searchMsg}</div>}
                {results.length > 0 && (
                  <div className="mt-2 border border-line rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    {results.map((r, i) => (
                      <button key={r.symbol + (r.cgId || "") + i} onClick={() => pickResult(r)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left border-b border-line/40 last:border-0">
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: accent, color: "#0B1020" }}>{r.symbol.slice(0, 1)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-[11px] text-muted">{cryptoMode ? (r.rank ? `Krypto - Rang ${r.rank}` : "Krypto") : "Aktie"}</div>
                        </div>
                        <span className="num text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: `${accent}1a`, color: accent }}>{r.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-panel2/60 border rounded-2xl px-3 py-3" style={{ borderColor: accent }}>
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ background: accent, color: "#0B1020" }}>{picked.symbol.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{picked.name} <span className="num text-xs" style={{ color: accent }}>{picked.symbol}</span></div>
                    <div className="text-[11px] text-muted">{priceMsg || (cryptoMode ? "Krypto" : "Aktie")}</div>
                  </div>
                  <button onClick={unpick} className="text-xs text-muted hover:text-ink2 shrink-0 underline underline-offset-2">Ändern</button>
                </div>
                <div className={`grid ${cryptoMode ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
                  <input autoFocus className="input num" placeholder="Stueck / Anzahl" value={shares} onChange={e => setShares(e.target.value)} onKeyDown={e => e.key === "Enter" && addPosition()} />
                  <input className="input num" placeholder={`Kaufkurs (${cryptoMode ? "EUR" : curr})`} value={buy} onChange={e => setBuy(e.target.value)} onKeyDown={e => e.key === "Enter" && addPosition()} />
                  {!cryptoMode && <select className="input" value={curr} onChange={e => setCurr(e.target.value as Currency)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="CHF">CHF</option></select>}
                </div>
                <button className="btn w-full" onClick={addPosition} disabled={!shares}>{picked.symbol} zum Depot hinzufuegen</button>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="font-semibold display mb-2">Allokation</div>
          {pieData.length > 0 ? (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={3} stroke="none">{pieData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie>
                  <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v) => [fmt2(Number(v), main), "Wert"]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#8794B0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-muted text-sm py-10 text-center">Such dir oben eine Aktie oder einen Coin und leg los.</div>}
        </div>
      </div>
    </div>
  );
}
