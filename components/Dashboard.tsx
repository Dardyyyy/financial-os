import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, AreaChart, Area } from "recharts";
import { Tx, Currency, Asset, Holding, BudgetData, Goal, loadTransactions, saveTransactions, loadAssets, loadHoldings, loadBudget, loadGoals, loadSettings, getFxMap, eur, eur2, money, fmt, convertCur, mortgageCalc, uid, Snapshot, loadSnapshots, saveSnapshots, upsertSnapshot } from "../lib/store";
import CountUp from "./CountUp";

const CURRENCIES: Currency[] = ["EUR", "USD", "CHF"];

export default function Dashboard() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [ready, setReady] = useState(false);
  const [fxMap, setFxMap] = useState<Record<string, number>>({ EUR: 1, USD: 0.92, CHF: 1.05 });
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [curr, setCurr] = useState<Currency>("EUR");
  const [main, setMain] = useState<Currency>("CHF");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [holds, setHolds] = useState<Holding[]>([]);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);

  useEffect(() => {
    loadTransactions().then(t => { setTxs(t); setReady(true); });
    getFxMap(["USD", "CHF", "EUR"]).then(setFxMap);
    loadSettings().then(st => setMain(st.mainCurrency));
    loadAssets().then(setAssets);
    loadHoldings().then(setHolds);
    loadBudget().then(setBudget);
    loadGoals().then(setGoals);
    loadSnapshots().then(setSnaps);
  }, []);

  const toEur = (amt: number, c: Currency) => amt * (fxMap[c] ?? 1);
  const toMain = (amt: number, c: Currency) => convertCur(amt, c, main, fxMap);

  const depotMain = useMemo(() => holds.reduce((s, h) => s + toMain(h.shares * h.lastPrice, h.currency), 0), [holds, fxMap, main]);
  const sachwerteMain = useMemo(() => assets.reduce((s, a) => s + toMain(a.value || 0, (a.currency || "EUR") as Currency), 0), [assets, fxMap, main]);
  const schuldenMain = useMemo(() => assets.reduce((s, a) => {
    const d = a.kind === "immobilie" && a.mortgage ? mortgageCalc(a.mortgage).outstanding : (a.debt || 0);
    return s + toMain(d, (a.currency || "EUR") as Currency);
  }, 0), [assets, fxMap, main]);
  const nettovermoegen = sachwerteMain + depotMain - schuldenMain;

  const freiMain = useMemo(() => {
    if (!budget) return 0;
    const bc = (budget.currency || main) as Currency;
    const fix = budget.fixed.reduce((x, f) => x + f.amount, 0);
    const einmalMt = budget.oneTime.reduce((x, o) => x + o.amount, 0) / 12;
    return toMain(budget.income - fix - einmalMt, bc);
  }, [budget, fxMap, main]);

  const goalsDone = goals.filter(g => g.done).length;
  const goalsQuote = goals.length ? Math.round((goalsDone / goals.length) * 100) : 0;

  // Monatlichen Schnappschuss automatisch festhalten (aktueller Monat wird ueberschrieben)
  useEffect(() => {
    if (!ready) return;
    if (!(assets.length || holds.length || budget)) return;
    const month = new Date().toISOString().slice(0, 7);
    const e = (n: number) => convertCur(n, main, "EUR", fxMap);
    const snap: Snapshot = { month, netEur: e(nettovermoegen), sachwerteEur: e(sachwerteMain), depotEur: e(depotMain), schuldenEur: e(schuldenMain) };
    setSnaps(prev => {
      const cur = prev.find(x => x.month === month);
      if (cur && Math.abs(cur.netEur - snap.netEur) < 1) return prev; // nichts Wesentliches geaendert
      const next = upsertSnapshot(prev, snap);
      saveSnapshots(next);
      return next;
    });
  }, [ready, nettovermoegen, sachwerteMain, depotMain, schuldenMain, assets, holds, budget, fxMap, main]);

  const verlauf = useMemo(() => snaps.map(s2 => ({
    label: (() => { const [y, m] = s2.month.split("-"); return `${m}/${y.slice(2)}`; })(),
    wert: Math.round(convertCur(s2.netEur, "EUR", main, fxMap)),
  })), [snaps, fxMap, main]);

  const monthNow = new Date().toISOString().slice(0, 7);
  const prevSnap = useMemo(() => snaps.filter(s2 => s2.month < monthNow).slice(-1)[0], [snaps, monthNow]);
  const deltaVormonat = prevSnap ? nettovermoegen - convertCur(prevSnap.netEur, "EUR", main, fxMap) : null;

  const categorySuggestions = useMemo(() => {
    const d = ["Einkommen", "Wohnen", "Essen", "Freizeit", "Investment", "Sonstiges"];
    return Array.from(new Set([...d, ...txs.map(t => t.category)]));
  }, [txs]);

  const income = useMemo(() => txs.filter(t => t.amount > 0).reduce((s, t) => s + toEur(t.amount, t.currency), 0), [txs, fxMap]);
  const expense = useMemo(() => txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(toEur(t.amount, t.currency)), 0), [txs, fxMap]);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.max(0, (balance / income) * 100) : 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter(t => t.amount < 0).forEach(t => m.set(t.category, (m.get(t.category) || 0) + Math.abs(toEur(t.amount, t.currency))));
    return Array.from(m, ([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [txs, fxMap]);

  const palette = ["#F5B544", "#5EEAD4", "#A78BFA", "#FB7185", "#60A5FA", "#FBBF24"];

  const addTx = () => {
    const raw = parseFloat(amount.replace(",", "."));
    const cat = category.trim() || "Sonstiges";
    if (!desc.trim() || isNaN(raw)) return;
    const signed = txType === "income" ? Math.abs(raw) : -Math.abs(raw);
    const next = [{ id: uid(), date: new Date().toISOString().slice(0, 10), desc: desc.trim(), category: cat, amount: signed, currency: curr }, ...txs];
    setTxs(next); saveTransactions(next);
    setDesc(""); setAmount(""); setCategory("");
  };
  const removeTx = (id: string) => { const n = txs.filter(t => t.id !== id); setTxs(n); saveTransactions(n); };

  return (
    <div className="space-y-5">
      {/* Gesamtuebersicht */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr] gap-4">
        <div className="card card-hl p-6">
          <div className="text-sm text-muted">Nettovermögen</div>
          <div className="display text-4xl font-bold mt-1 text-gold">{ready ? <CountUp value={nettovermoegen} format={(n: number) => fmt(n, main)} /> : "—"}</div>
          {deltaVormonat !== null && <div className="text-xs mt-1 num" style={{ color: deltaVormonat >= 0 ? "#5EEAD4" : "#FB7185" }}>{deltaVormonat >= 0 ? "▲ +" : "▼ "}{fmt(deltaVormonat, main)} vs. Vormonat</div>}
          <div className="flex gap-4 text-xs text-muted mt-3 flex-wrap">
            <span>Sachwerte <span className="num text-ink2">{fmt(sachwerteMain, main)}</span></span>
            <span>Depot <span className="num text-ink2">{fmt(depotMain, main)}</span></span>
            <span>Schulden <span className="num text-bad">{fmt(schuldenMain, main)}</span></span>
          </div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted">Frei zum Anlegen / Monat</div>
          <div className="display text-2xl font-bold mt-2" style={{ color: freiMain >= 0 ? "#5EEAD4" : "#FB7185" }}>{ready ? <CountUp value={freiMain} format={(n: number) => fmt(n, main)} /> : "—"}</div>
          <div className="text-xs text-muted mt-2">aus deinem Budget</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-muted">Ziele erfüllt</div>
          <div className="display text-2xl font-bold mt-2 text-gold num">{goalsDone}<span className="text-muted text-base">/{goals.length}</span></div>
          <div className="h-1.5 rounded-full bg-panel2 mt-3 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${goalsQuote}%`, background: "linear-gradient(90deg,#F5B544,#5EEAD4)" }} /></div>
        </div>
      </div>

      {/* Nettovermoegen-Verlauf */}
      <div className="card p-6">
        <div className="font-semibold display mb-1">Nettovermögen-Verlauf</div>
        <div className="text-xs text-muted mb-4">Monatliche Schnappschüsse · in {main}</div>
        {verlauf.length < 2 ? (
          <div className="text-muted text-sm py-8 text-center">Der Verlauf füllt sich ab dem nächsten Monat — der erste Schnappschuss ist gespeichert.</div>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={verlauf} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5B544" stopOpacity={0.5} /><stop offset="100%" stopColor="#F5B544" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12, padding: "10px 12px" }} labelStyle={{ color: "#F5B544", fontWeight: 700, marginBottom: 4, fontSize: 13 }} itemStyle={{ color: "#FFFFFF", fontSize: 14, fontFamily: "var(--font-mono)" }} formatter={(v) => [fmt(Number(v), main), "Nettovermögen"]} />
                <Area type="monotone" dataKey="wert" stroke="#F5B544" strokeWidth={2.5} fill="url(#nwg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Cashflow aus erfassten Transaktionen */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <div className="card p-6">
          <div className="text-sm text-muted">Cashflow · erfasste Transaktionen</div>
          <div className={`display text-4xl font-bold mt-2 ${balance >= 0 ? "text-gold" : "text-bad"}`}>{ready ? <CountUp value={balance} format={eur} /> : "—"}</div>
          <div className="text-xs text-muted mt-3">Sparquote <span className="num text-mint">{savingsRate.toFixed(0)}%</span></div>
        </div>
        <Kpi label="Einnahmen" value={income} tone="mint" ready={ready} />
        <Kpi label="Ausgaben" value={expense} tone="bad" ready={ready} />
      </div>

      <div className="card p-6">
        <div className="font-semibold display mb-5">Ausgaben nach Kategorie</div>
        {byCategory.length === 0 ? (
          <div className="text-muted text-sm py-10 text-center">Noch keine Ausgaben erfasst.</div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byCategory} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#8794B0", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8794B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(245,181,68,0.07)" }}
                  contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12, padding: "10px 12px" }}
                  labelStyle={{ color: "#F5B544", fontWeight: 700, marginBottom: 4, fontSize: 13 }}
                  itemStyle={{ color: "#FFFFFF", fontSize: 14, fontFamily: "var(--font-mono)" }}
                  formatter={(v) => [eur2(Number(v)), "Ausgaben"]}
                />
                <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={56}>
                  {byCategory.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="font-semibold display mb-4">Transaktion erfassen</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setTxType("expense")} className="chip" style={txType === "expense" ? { background: "rgba(251,113,133,0.15)", borderColor: "#FB7185", color: "#fff" } : {}}>− Ausgabe</button>
          <button onClick={() => setTxType("income")} className="chip" style={txType === "income" ? { background: "rgba(94,234,212,0.15)", borderColor: "#5EEAD4", color: "#fff" } : {}}>+ Einnahme</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto_1.4fr_auto] gap-3">
          <input className="input" placeholder="Beschreibung" value={desc} onChange={e => setDesc(e.target.value)} />
          <input className="input num" placeholder="Betrag z.B. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="input" value={curr} onChange={e => setCurr(e.target.value as Currency)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" placeholder="Kategorie (frei wählbar)" list="cat-list" value={category} onChange={e => setCategory(e.target.value)} />
          <datalist id="cat-list">{categorySuggestions.map(c => <option key={c} value={c} />)}</datalist>
          <button className="btn" onClick={addTx}>Hinzufügen</button>
        </div>
      </div>

      <div className="card p-6">
        <div className="font-semibold display mb-4">Letzte Transaktionen</div>
        <div className="divide-y divide-line/50">
          {txs.map(t => (
            <div key={t.id} className="flex items-center justify-between py-3 group">
              <div>
                <div className="font-medium">{t.desc}</div>
                <div className="text-xs text-muted">{t.date} · {t.category}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`num font-semibold ${t.amount >= 0 ? "text-mint" : "text-ink2"}`}>{t.amount >= 0 ? "+" : ""}{money(t.amount, t.currency)}</div>
                  {t.currency !== "EUR" && <div className="num text-[11px] text-muted">≈ {eur2(t.amount * (fxMap[t.currency] ?? 1))}</div>}
                </div>
                <button onClick={() => removeTx(t.id)} className="x-btn">✕</button>
              </div>
            </div>
          ))}
          {ready && txs.length === 0 && <div className="text-muted text-sm py-4">Noch keine Transaktionen.</div>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, ready }: { label: string; value: number; tone: "mint" | "bad"; ready: boolean }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className={`display text-2xl font-bold mt-2 ${tone === "mint" ? "text-mint" : "text-bad"}`}>{ready ? <CountUp value={value} format={eur} /> : "—"}</div>
    </div>
  );
}
