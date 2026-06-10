import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { loadWatchlist, saveWatchlist, getUsdEur, usd, eur, eur2 } from "../lib/store";

type Quote = { price: number; change: number };
type CatId = "stock" | "etf" | "crypto" | "custom";

const CATS: { id: CatId; label: string; icon: string; rate: number; color: string; note: string }[] = [
  { id: "stock", label: "Einzelaktie", icon: "📈", rate: 9, color: "#F5B544", note: "Live-Kurs aus deiner Watchlist" },
  { id: "etf", label: "ETF / Index", icon: "🧺", rate: 7, color: "#5EEAD4", note: "z.B. MSCI World, breit gestreut" },
  { id: "crypto", label: "Krypto", icon: "🪙", rate: 15, color: "#A78BFA", note: "hohe Chance, hohes Risiko" },
  { id: "custom", label: "Eigene", icon: "✏️", rate: 8, color: "#60A5FA", note: "freie Annahme" },
];

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

  // Projektion
  const proj = useMemo(() => {
    const s0 = mode === "monthly" ? 0 : start;
    const mRate = mode === "once" ? 0 : monthly;
    const r = rate / 100 / 12;
    const pts: { year: number; eingezahlt: number; wert: number }[] = [{ year: 0, eingezahlt: Math.round(s0), wert: Math.round(s0) }];
    let v = s0, contrib = s0;
    for (let mo = 1; mo <= years * 12; mo++) { v = v * (1 + r) + mRate; contrib += mRate; if (mo % 12 === 0) pts.push({ year: mo / 12, eingezahlt: Math.round(contrib), wert: Math.round(v) }); }
    return pts;
  }, [mode, start, monthly, years, rate]);
  const fin = proj[proj.length - 1];
  const invested = fin.eingezahlt, endValue = fin.wert, gain = endValue - invested;

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
            <div className="text-xs uppercase tracking-widest text-mint mb-1">Top Gainer heute</div>
            <div className="flex items-baseline justify-between"><span className="display text-2xl font-bold">{topGainer.sym}</span><span className="num text-mint text-lg">▲ {topGainer.change.toFixed(2)}%</span></div>
            <div className="num text-muted text-sm mt-1">{usd(topGainer.price)}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-widest text-bad mb-1">Größter Verlierer heute</div>
            <div className="flex items-baseline justify-between"><span className="display text-2xl font-bold">{topLoser.sym}</span><span className={`num text-lg ${topLoser.change >= 0 ? "text-mint" : "text-bad"}`}>{topLoser.change >= 0 ? "▲" : "▼"} {Math.abs(topLoser.change).toFixed(2)}%</span></div>
            <div className="num text-muted text-sm mt-1">{usd(topLoser.price)}</div>
          </div>
        </div>
      )}

      {movers.length > 0 && (
        <div className="card p-6">
          <div className="font-semibold display mb-4">Watchlist · nach Tagesbewegung</div>
          <div className="space-y-2">
            {movers.map((m, i) => (
              <div key={m.sym} className="flex items-center justify-between py-2 border-b border-line/40">
                <div className="flex items-center gap-3"><span className="num text-xs text-muted w-5">{i + 1}</span><span className="font-semibold w-16">{m.sym}</span></div>
                <div className="flex items-center gap-5">
                  <span className="num text-sm text-muted">{usd(m.price)}</span>
                  <span className={`num text-sm w-20 text-right ${m.change >= 0 ? "text-mint" : "text-bad"}`}>{m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change).toFixed(2)}%</span>
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

        {/* Slider */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {mode !== "monthly" && <Slider label="Startbetrag" val={eur(start)}><input type="range" min={0} max={100000} step={500} value={start} onChange={e => setStart(+e.target.value)} className="w-full accent-gold" /></Slider>}
          {mode !== "once" && <Slider label="Monatliche Rate" val={eur(monthly)}><input type="range" min={0} max={3000} step={25} value={monthly} onChange={e => setMonthly(+e.target.value)} className="w-full accent-gold" /></Slider>}
          <Slider label="Laufzeit" val={`${years} Jahre`}><input type="range" min={1} max={40} step={1} value={years} onChange={e => setYears(+e.target.value)} className="w-full accent-gold" /></Slider>
          <Slider label="Erwartete Rendite p.a." val={`${rate}%`}><input type="range" min={0} max={20} step={0.5} value={rate} onChange={e => setRate(+e.target.value)} className="w-full accent-gold" /></Slider>
        </div>

        {/* Ergebnis-Karten */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Endwert" val={eur(endValue)} tone="gold" />
          <Stat label="Eingezahlt" val={eur(invested)} tone="muted" />
          <Stat label="Gewinn" val={eur(gain)} tone="mint" />
          <Stat label={cat === "stock" ? `Stück ${sym}` : "Faktor"} val={cat === "stock" ? sharesNow.toFixed(2) : `${(invested > 0 ? endValue / invested : 0).toFixed(1)}×`} tone="default" />
        </div>

        {/* Chart */}
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={proj} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="mWert" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={catObj.color} stopOpacity={0.45} /><stop offset="100%" stopColor={catObj.color} stopOpacity={0} /></linearGradient>
                <linearGradient id="mEin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8794B0" stopOpacity={0.22} /><stop offset="100%" stopColor="#8794B0" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(y) => `${y}J`} />
              <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "#0C1322", border: `1px solid ${catObj.color}`, borderRadius: 12 }} labelStyle={{ color: catObj.color }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v, n) => [eur2(Number(v)), n === "wert" ? "Wert" : "Eingezahlt"]} labelFormatter={(l) => `Jahr ${l}`} />
              <Area type="monotone" dataKey="eingezahlt" stroke="#8794B0" fill="url(#mEin)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="wert" stroke={catObj.color} fill="url(#mWert)" strokeWidth={2.5} />
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
        className="input flex items-center justify-between gap-3 min-w-[150px] cursor-pointer"
        style={{ borderColor: open ? "#F5B544" : "#26314D" }}>
        <span className="num font-semibold">{value || "—"}</span>
        <span className="text-muted text-xs">{open ? "\u25B4" : "\u25BE"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 w-full min-w-[150px] max-h-64 overflow-y-auto card p-1.5 shadow-glow">
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm num transition ${o === value ? "text-gold" : "text-ink2 hover:bg-white/5"}`}
                style={o === value ? { background: "rgba(245,181,68,0.14)" } : {}}>
                {o}
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
function Stat({ label, val, tone }: { label: string; val: string; tone: "gold" | "mint" | "muted" | "default" }) {
  const color = tone === "gold" ? "text-gold" : tone === "mint" ? "text-mint" : tone === "muted" ? "text-muted" : "text-ink2";
  return (<div className="bg-panel2/60 border border-line/50 rounded-xl p-4"><div className="text-xs text-muted">{label}</div><div className={`display text-xl font-bold mt-1 num ${color}`}>{val}</div></div>);
}
