import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { loadWatchlist, saveWatchlist, getUsdEur, usd, eur, eur2, companyName } from "../lib/store";

type Quote = { price: number; change: number };
type CatId = "stock" | "etf" | "crypto" | "custom";

const CATS: { id: CatId; label: string; icon: string; rate: number; color: string; note: string }[] = [
  { id: "stock", label: "Einzelaktie", icon: "📈", rate: 9, color: "#F5B544", note: "Live-Kurs aus deiner Watchlist" },
  { id: "etf", label: "ETF / Index", icon: "🧺", rate: 7, color: "#5EEAD4", note: "z.B. MSCI World, breit gestreut" },
  { id: "crypto", label: "Krypto", icon: "🪙", rate: 15, color: "#A78BFA", note: "hohe Chance, hohes Risiko" },
  { id: "custom", label: "Eigene", icon: "✏️", rate: 8, color: "#60A5FA", note: "freie Annahme" },
];

// Risiko-Bandbreite je Kategorie (± Prozentpunkte um die erwartete Rendite)
const SPREAD: Record<CatId, number> = { stock: 3, etf: 2.5, crypto: 8, custom: 2 };

export default function Market() {
  const [watch, setWatch] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState("");
  const [fx, setFx] = useState(0.92);
  const [newT, setNewT] = useState("");

  // Rechner
  const [cat, setCat] = useState<CatId>("etf");
  const [mode, setMode] = useState<"once" | "monthly" | "both">("both");
  const [start, setStart] = useState(5000);
  const [monthly, setMonthly] = useState(300);
  const [years, setYears] = useState(15);
  const [rate, setRate] = useState(7);
  const [sym, setSym] = useState("");
  const [realMode, setRealMode] = useState(false);

  const fetchQuotes = async (list: string[]) => {
    if (!list.length) { setQuotes({}); return; }
    setLoading(true); setWarn("");
    try {
      const r = await fetch(`/api/quote?type=stock&symbols=${list.join(",")}`).then(x => x.json());
      if (r.warning) setWarn(r.warning);
      const q: Record<string, Quote> = {};
      list.forEach(s => { if (r.prices?.[s] != null) q[s] = { price: r.prices[s], change: r.changes?.[s] ?? 0 }; });
      setQuotes(q);
    } catch { setWarn("Konnte Kurse nicht laden."); } finally { setLoading(false); }
  };

  useEffect(() => {
    loadWatchlist().then(w => { setWatch(w); setSym(w[0] || ""); fetchQuotes(w); });
    getUsdEur().then(setFx);
  }, []);

  const movers = useMemo(() =>
    watch.map(s => ({ sym: s, ...(quotes[s] || { price: 0, change: 0 }) })).filter(m => m.price > 0).sort((a, b) => b.change - a.change),
    [watch, quotes]);
  const topGainer = movers[0];
  const topLoser = movers[movers.length - 1];

  const pickCat = (c: CatId) => { setCat(c); setRate(CATS.find(x => x.id === c)!.rate); };
  const addTicker = () => { const t = newT.toUpperCase().trim(); if (!t || watch.includes(t)) { setNewT(""); return; } const n = [...watch, t]; setWatch(n); saveWatchlist(n); setNewT(""); fetchQuotes(n); };
  const removeTicker = (t: string) => { const n = watch.filter(x => x !== t); setWatch(n); saveWatchlist(n); if (sym === t) setSym(n[0] || ""); };

  // Projektion mit Szenario-Band (pessimistisch / erwartet / optimistisch)
  const calc = useMemo(() => {
    const s0 = mode === "monthly" ? 0 : start;
    const mRate = mode === "once" ? 0 : monthly;
    const spread = SPREAD[cat];
    const series = (annual: number) => {
      const r = annual / 100 / 12; let v = s0; const arr = [s0];
      for (let mo = 1; mo <= years * 12; mo++) { v = v * (1 + r) + mRate; if (mo % 12 === 0) arr.push(v); }
      return arr;
    };
    const lo = series(Math.max(0, rate - spread)), ba = series(rate), hi = series(rate + spread);
    let contrib = s0; const cArr = [s0];
    for (let mo = 1; mo <= years * 12; mo++) { contrib += mRate; if (mo % 12 === 0) cArr.push(contrib); }
    const pts = ba.map((b, i) => ({ year: i, eingezahlt: Math.round(cArr[i]), base: Math.round(b), band: [Math.round(lo[i]), Math.round(hi[i])] as [number, number] }));
    return { pts, invested: Math.round(cArr[cArr.length - 1]), low: Math.round(lo[lo.length - 1]), base: Math.round(ba[ba.length - 1]), high: Math.round(hi[hi.length - 1]) };
  }, [mode, start, monthly, years, rate, cat]);

  const proj = calc.pts;
  const infl = Math.pow(1.02, years);
  const adj = (n: number) => (realMode ? n / infl : n);
  const invested = calc.invested;
  const endValue = adj(calc.base);
  const gain = endValue - invested;
  const loVal = adj(calc.low), hiVal = adj(calc.high);
  const kEUR = (n: number) => `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;

  const priceEur = (quotes[sym]?.price || 0) * fx;
  const sharesNow = cat === "stock" && priceEur > 0 ? (mode === "monthly" ? 0 : start) / priceEur : 0;
  const catObj = CATS.find(c => c.id === cat)!;

  return (
    <div className="space-y-5">
      {/* ===== Top Mover ===== */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" onClick={() => fetchQuotes(watch)} disabled={loading}>{loading ? "Lädt…" : "↻ Kurse aktualisieren"}</button>
        <span className="text-xs text-muted">Tagesbewegung deiner Watchlist · Kurse in USD</span>
      </div>

      {warn && <div className="card p-4 text-sm text-muted border border-bad/30">⚠ {warn}</div>}

      {movers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card card-hl p-5">
            <div className="text-xs uppercase tracking-widest text-mint mb-2">Top Gainer heute</div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="display text-xl font-bold leading-tight truncate">{companyName(topGainer.sym)}</div>
                <div className="num text-xs text-muted mt-1">{topGainer.sym} · {usd(topGainer.price)}</div>
              </div>
              <span className="num text-mint text-lg shrink-0">▲ {topGainer.change.toFixed(2)}%</span>
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-widest text-bad mb-2">Größter Verlierer heute</div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="display text-xl font-bold leading-tight truncate">{companyName(topLoser.sym)}</div>
                <div className="num text-xs text-muted mt-1">{topLoser.sym} · {usd(topLoser.price)}</div>
              </div>
              <span className={`num text-lg shrink-0 ${topLoser.change >= 0 ? "text-mint" : "text-bad"}`}>{topLoser.change >= 0 ? "▲" : "▼"} {Math.abs(topLoser.change).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}

      {movers.length > 0 && (
        <div className="card p-6">
          <div className="font-semibold display mb-4">Watchlist · nach Tagesbewegung</div>
          <div className="space-y-1">
            {movers.map((m, i) => (
              <div key={m.sym} className="flex items-center justify-between gap-3 py-2.5 border-b border-line/40 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="num text-xs text-muted w-5 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate">{companyName(m.sym)}</div>
                    <div className="num text-[11px] text-muted">{m.sym} · {usd(m.price)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`num text-sm ${m.change >= 0 ? "text-mint" : "text-bad"}`}>{m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change).toFixed(2)}%</span>
                  <button onClick={() => removeTicker(m.sym)} className="text-muted hover:text-bad">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <input className="input" placeholder="Ticker hinzufügen (z.B. SMCI)" value={newT} onChange={e => setNewT(e.target.value)} onKeyDown={e => e.key === "Enter" && addTicker()} />
            <button className="btn-ghost px-4 rounded-xl" onClick={addTicker}>+ Hinzufügen</button>
          </div>
        </div>
      )}

      {/* ===== Investitions-Rechner ===== */}
      <div className="card card-hl p-6 space-y-6">
        <div>
          <div className="display text-lg font-semibold">Investitions-Rechner</div>
          <div className="text-xs text-muted mt-1">Was wird aus deinem Geld? Wähle eine Anlageform und spiel mit den Reglern.</div>
        </div>

        {/* Kategorie-Auswahl */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATS.map(c => (
            <button key={c.id} onClick={() => pickCat(c.id)}
              className="rounded-2xl p-4 text-left border transition"
              style={cat === c.id ? { borderColor: c.color, background: `${c.color}14` } : { borderColor: "#26314D", background: "transparent" }}>
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="font-semibold text-sm" style={cat === c.id ? { color: c.color } : {}}>{c.label}</div>
              <div className="text-[11px] text-muted mt-0.5 leading-tight">{c.note}</div>
            </button>
          ))}
        </div>

        {/* Aktie waehlen (nur Kategorie Einzelaktie) */}
        {cat === "stock" && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted">Wert:</span>
            <StockSelect value={sym} options={watch} onChange={setSym} />
            {priceEur > 0
              ? <span className="text-sm num">Live: {usd(quotes[sym].price)} <span className="text-muted">≈ {eur2(priceEur)}</span></span>
              : <span className="text-xs text-muted">Kein Live-Kurs — „↻ Kurse aktualisieren" / Finnhub-Key prüfen.</span>}
          </div>
        )}

        {/* Anlageart */}
        <div className="flex gap-2">
          {([["both", "Start + Sparplan"], ["once", "Einmalanlage"], ["monthly", "Nur Sparplan"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} className="chip" style={mode === id ? { borderColor: catObj.color, color: "#fff", background: `${catObj.color}18` } : {}}>{label}</button>
          ))}
        </div>

        {/* Inflations-Schalter */}
        <label className="inline-flex items-center gap-2 chip cursor-pointer select-none" style={realMode ? { borderColor: catObj.color, color: "#fff", background: `${catObj.color}18` } : {}}>
          <input type="checkbox" checked={realMode} onChange={e => setRealMode(e.target.checked)} className="accent-gold w-4 h-4" />
          kaufkraftbereinigt (2% Inflation)
        </label>

        {/* Slider */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {mode !== "monthly" && <Slider label="Startbetrag" val={eur(start)}><input type="range" min={0} max={100000} step={500} value={start} onChange={e => setStart(+e.target.value)} className="w-full accent-gold" /></Slider>}
          {mode !== "once" && <Slider label="Monatliche Rate" val={eur(monthly)}><input type="range" min={0} max={3000} step={25} value={monthly} onChange={e => setMonthly(+e.target.value)} className="w-full accent-gold" /></Slider>}
          <Slider label="Laufzeit" val={`${years} Jahre`}><input type="range" min={1} max={40} step={1} value={years} onChange={e => setYears(+e.target.value)} className="w-full accent-gold" /></Slider>
          <Slider label="Erwartete Rendite p.a." val={`${rate}%`}><input type="range" min={0} max={20} step={0.5} value={rate} onChange={e => setRate(+e.target.value)} className="w-full accent-gold" /></Slider>
        </div>

        {/* Ergebnis-Karten */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={realMode ? "Erwartet (real)" : "Erwartet"} val={eur(endValue)} tone="gold" />
          <Stat label="Eingezahlt" val={eur(invested)} tone="muted" />
          <Stat label="Gewinn" val={eur(gain)} tone="mint" />
          <Stat label="Spanne (pess.–opt.)" val={`${kEUR(loVal)}–${kEUR(hiVal)} €`} tone="default" sub={`±${SPREAD[cat]}% p.a.`} />
        </div>
        <div className="text-[11px] text-muted -mt-3">Band = realistische Streuung dieser Anlageform: bei <b style={{ color: catObj.color }}>{catObj.label}</b> rechnet die App mit ±{SPREAD[cat]} Prozentpunkten um deine erwartete Rendite{cat === "stock" && sharesNow > 0 ? ` · entspricht ~${sharesNow.toFixed(2)} Stück ${sym}` : ""}.</div>

        {/* Chart */}
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={proj} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="mBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={catObj.color} stopOpacity={0.30} /><stop offset="100%" stopColor={catObj.color} stopOpacity={0.04} /></linearGradient>
                <linearGradient id="mEin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8794B0" stopOpacity={0.18} /><stop offset="100%" stopColor="#8794B0" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(y) => `${y}J`} />
              <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#0C1322", border: `1px solid ${catObj.color}`, borderRadius: 12 }} labelStyle={{ color: catObj.color }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v: any, n) => Array.isArray(v) ? [`${eur2(v[0])} – ${eur2(v[1])}`, "Spanne"] : [eur2(Number(v)), n === "base" ? "Erwartet" : "Eingezahlt"]} labelFormatter={(l) => `Jahr ${l}`} />
              <Area type="monotone" dataKey="band" stroke="none" fill="url(#mBand)" isAnimationActive={false} />
              <Area type="monotone" dataKey="eingezahlt" stroke="#8794B0" fill="url(#mEin)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="base" stroke={catObj.color} fill="none" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted">Zinseszins-Modellrechnung mit deiner angenommenen Rendite — keine Vorhersage, keine Anlageberatung. {cat === "stock" && "Stückzahl auf Basis des Live-Kurses (USD→EUR)."}</div>
      </div>
    </div>
  );
}

function StockSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="input flex items-center justify-between gap-3 min-w-[200px] cursor-pointer"
        style={{ borderColor: open ? "#F5B544" : "#26314D" }}>
        <span className="truncate text-left"><span className="font-semibold">{value ? companyName(value) : "—"}</span> {value && <span className="num text-xs text-muted">{value}</span>}</span>
        <span className="text-muted text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 w-full min-w-[220px] max-h-64 overflow-y-auto card p-1.5 shadow-glow">
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between gap-2 ${o === value ? "text-gold" : "text-ink2 hover:bg-white/5"}`}
                style={o === value ? { background: "rgba(245,181,68,0.14)" } : {}}>
                <span className="truncate">{companyName(o)}</span>
                <span className="num text-[11px] text-muted shrink-0">{o}</span>
              </button>
            ))}
            {options.length === 0 && <div className="text-muted text-xs px-3 py-2">Keine Werte in der Watchlist</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Slider({ label, val, children }: { label: string; val: string; children: ReactNode }) {
  return (<div><div className="flex justify-between text-sm mb-2"><span className="text-muted">{label}</span><span className="num text-ink2 font-semibold">{val}</span></div>{children}</div>);
}
function Stat({ label, val, tone, sub }: { label: string; val: string; tone: "gold" | "mint" | "muted" | "default"; sub?: string }) {
  const color = tone === "gold" ? "text-gold" : tone === "mint" ? "text-mint" : tone === "muted" ? "text-muted" : "text-ink2";
  return (<div className="bg-panel2/60 border border-line/50 rounded-xl p-4"><div className="text-xs text-muted">{label}</div><div className={`display text-xl font-bold mt-1 num ${color}`}>{val}</div>{sub && <div className="text-[10px] text-muted num mt-0.5">{sub}</div>}</div>);
}
