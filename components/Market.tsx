import { useEffect, useMemo, useState } from "react";
import { loadWatchlist, saveWatchlist, getUsdEur, usd, eur, uid } from "../lib/store";

type Quote = { price: number; change: number };

export default function Market() {
  const [watch, setWatch] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState("");
  const [fx, setFx] = useState(0.92);
  const [newT, setNewT] = useState("");

  // Rechner
  const [sym, setSym] = useState("");
  const [amount, setAmount] = useState("1000");
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(8);

  const fetchQuotes = async (list: string[]) => {
    if (!list.length) { setQuotes({}); return; }
    setLoading(true); setWarn("");
    try {
      const r = await fetch(`/api/quote?type=stock&symbols=${list.join(",")}`).then(x => x.json());
      if (r.warning) setWarn(r.warning);
      const q: Record<string, Quote> = {};
      list.forEach(s => { if (r.prices?.[s] != null) q[s] = { price: r.prices[s], change: r.changes?.[s] ?? 0 }; });
      setQuotes(q);
    } catch { setWarn("Konnte Kurse nicht laden."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadWatchlist().then(w => { setWatch(w); setSym(w[0] || ""); fetchQuotes(w); });
    getUsdEur().then(setFx);
  }, []);

  const movers = useMemo(() =>
    watch.map(s => ({ sym: s, ...(quotes[s] || { price: 0, change: 0 }) }))
      .filter(m => m.price > 0)
      .sort((a, b) => b.change - a.change), [watch, quotes]);

  const topGainer = movers[0];
  const topLoser = movers[movers.length - 1];

  const addTicker = () => {
    const t = newT.toUpperCase().trim();
    if (!t || watch.includes(t)) { setNewT(""); return; }
    const next = [...watch, t]; setWatch(next); saveWatchlist(next); setNewT("");
    fetchQuotes(next);
  };
  const removeTicker = (t: string) => {
    const next = watch.filter(x => x !== t); setWatch(next); saveWatchlist(next);
    if (sym === t) setSym(next[0] || "");
  };

  // Rechner-Ergebnis
  const priceUsd = quotes[sym]?.price || 0;
  const priceEur = priceUsd * fx;
  const amt = parseFloat(amount.replace(",", ".")) || 0;
  const sharesNow = priceEur > 0 ? amt / priceEur : 0;
  const future = amt * Math.pow(1 + rate / 100, years);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" onClick={() => fetchQuotes(watch)} disabled={loading}>{loading ? "Lädt…" : "↻ Kurse aktualisieren"}</button>
        <span className="text-xs text-muted">Tagesveränderung aus deiner Watchlist · Kurse in USD</span>
      </div>

      {warn && <div className="card p-4 text-sm text-bad/90 border border-bad/30">⚠ {warn} Bis dahin bleibt diese Ansicht leer — ich zeige bewusst keine erfundenen Zahlen.</div>}

      {/* Top Mover Highlights */}
      {movers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card card-hl p-5">
            <div className="text-xs uppercase tracking-widest text-mint mb-1">Top Gainer heute</div>
            <div className="flex items-baseline justify-between">
              <span className="display text-2xl font-bold">{topGainer.sym}</span>
              <span className="num text-mint text-lg">▲ {topGainer.change.toFixed(2)}%</span>
            </div>
            <div className="num text-muted text-sm mt-1">{usd(topGainer.price)}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-widest text-bad mb-1">Größter Verlierer heute</div>
            <div className="flex items-baseline justify-between">
              <span className="display text-2xl font-bold">{topLoser.sym}</span>
              <span className={`num text-lg ${topLoser.change >= 0 ? "text-mint" : "text-bad"}`}>{topLoser.change >= 0 ? "▲" : "▼"} {Math.abs(topLoser.change).toFixed(2)}%</span>
            </div>
            <div className="num text-muted text-sm mt-1">{usd(topLoser.price)}</div>
          </div>
        </div>
      )}

      {/* Watchlist */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold display">Watchlist · nach Tagesbewegung</div>
          <span className="text-xs text-muted">{movers.length} Werte mit Live-Daten</span>
        </div>
        <div className="space-y-2">
          {movers.map((m, i) => (
            <div key={m.sym} className="flex items-center justify-between py-2 border-b border-line/40 group">
              <div className="flex items-center gap-3">
                <span className="num text-xs text-muted w-5">{i + 1}</span>
                <span className="font-semibold w-16">{m.sym}</span>
              </div>
              <div className="flex items-center gap-5">
                <span className="num text-sm text-muted">{usd(m.price)}</span>
                <span className={`num text-sm w-20 text-right ${m.change >= 0 ? "text-mint" : "text-bad"}`}>{m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change).toFixed(2)}%</span>
                <button onClick={() => removeTicker(m.sym)} className="text-muted hover:text-bad opacity-0 group-hover:opacity-100 transition">✕</button>
              </div>
            </div>
          ))}
          {!loading && movers.length === 0 && !warn && <div className="text-muted text-sm py-3">Keine Live-Daten. Auf „Kurse aktualisieren" tippen.</div>}
        </div>
        <div className="flex gap-2 mt-4">
          <input className="input" placeholder="Ticker hinzufügen (z.B. SMCI)" value={newT} onChange={e => setNewT(e.target.value)} onKeyDown={e => e.key === "Enter" && addTicker()} />
          <button className="btn-ghost px-4 rounded-xl" onClick={addTicker}>+ Hinzufügen</button>
        </div>
      </div>

      {/* Investitions-Rechner */}
      <div className="card card-hl p-6">
        <div className="font-semibold display mb-4">Investitions-Rechner</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
          <div>
            <div className="text-xs text-muted mb-1">Wert</div>
            <select className="input" value={sym} onChange={e => setSym(e.target.value)}>
              {watch.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Betrag (EUR)</div>
            <input className="input num" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Laufzeit (Jahre)</div>
            <input className="input num" type="number" value={years} onChange={e => setYears(+e.target.value || 0)} />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Rendite p.a. (%)</div>
            <input className="input num" type="number" value={rate} onChange={e => setRate(+e.target.value || 0)} />
          </div>
        </div>

        {priceUsd > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={`Live-Kurs ${sym}`} val={`${usd(priceUsd)}`} sub={`≈ ${eur(priceEur)}`} tone="muted" />
            <Stat label="Stück für deinen Betrag" val={sharesNow.toFixed(2)} sub={`bei ${eur(priceEur)} / Stück`} tone="gold" />
            <Stat label={`Wert in ${years} J. @ ${rate}%`} val={eur(future)} sub={`aus ${eur(amt)} (Modellrechnung)`} tone="mint" />
          </div>
        ) : (
          <div className="text-muted text-sm">Wähle einen Wert mit Live-Kurs (oben „Kurse aktualisieren").</div>
        )}
        <div className="text-xs text-muted mt-4">
          Stückzahl auf Basis des echten Live-Kurses (USD → EUR @ {fx.toFixed(3)}). Die Projektion ist eine reine Zinseszins-Modellrechnung mit deiner angenommenen Rendite — keine Vorhersage und keine Anlageberatung.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, val, sub, tone }: { label: string; val: string; sub: string; tone: "gold" | "mint" | "muted" }) {
  const color = tone === "gold" ? "text-gold" : tone === "mint" ? "text-mint" : "text-ink2";
  return (
    <div className="bg-panel2/60 border border-line/50 rounded-xl p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`display text-xl font-bold mt-1 num ${color}`}>{val}</div>
      <div className="text-xs text-muted mt-1">{sub}</div>
    </div>
  );
}
