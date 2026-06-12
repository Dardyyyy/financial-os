import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Asset, AssetKind, Mortgage, Currency, loadAssets, saveAssets, loadHoldings, getFxMap, loadSettings, saveSettings, fmt, fmt2, uid, convertCur, mortgageCalc, parseAmount} from "../lib/store";
import CountUp from "./CountUp";
import CurrencySelect from "./CurrencySelect";

const KIND: Record<AssetKind, { label: string; icon: string; color: string }> = {
  immobilie:   { label: "Immobilie",       icon: "🏠", color: "#F5B544" },
  bargeld:     { label: "Bargeld / Konto",  icon: "💶", color: "#5EEAD4" },
  edelmetall:  { label: "Edelmetall",       icon: "🥇", color: "#FBBF24" },
  beteiligung: { label: "Beteiligung",      icon: "🏢", color: "#A78BFA" },
  sonstiges:   { label: "Sonstiges",        icon: "📦", color: "#60A5FA" },
};
const KINDS = Object.keys(KIND) as AssetKind[];


// Deutsche Annuitaeten-Finanzierung durchrechnen

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [depot, setDepot] = useState(0);
  const [fxMap, setFxMap] = useState<Record<string, number>>({ EUR: 1, USD: 0.92, CHF: 1.05 });
  const [main, setMain] = useState<Currency>("CHF");
  const [aCur, setACur] = useState<Currency>("CHF");

  const [kind, setKind] = useState<AssetKind>("immobilie");
  const [name, setName] = useState(""); const [val, setVal] = useState(""); const [debt, setDebt] = useState("");
  const [price, setPrice] = useState(""); const [equity, setEquity] = useState("");
  const [rate, setRate] = useState("3.8"); const [tilgung, setTilgung] = useState("2.0");
  const [start, setStart] = useState("");

  useEffect(() => {
    loadAssets().then(a => { setAssets(a); setReady(true); });
    loadSettings().then(st => { setMain(st.mainCurrency); setACur(st.mainCurrency); });
    (async () => {
      const [h, fm] = await Promise.all([loadHoldings(), getFxMap(["USD", "EUR", "CHF"])]);
      setFxMap(fm);
      setDepot(h.reduce((s, x) => s + convertCur(x.shares * x.lastPrice, x.currency, "EUR", fm), 0)); // Depot in EUR-Basis
    })();
  }, []);
  const persist = (a: Asset[]) => { setAssets(a); saveAssets(a); };
  const changeMain = (c: Currency) => { setMain(c); saveSettings({ mainCurrency: c }); };
  const toMain = (a: number, c: Currency) => convertCur(a, c, main, fxMap);
  const eM = (n: number) => fmt(n, main);          // in Hauptwaehrung
  const depotMain = convertCur(depot, "EUR", main, fxMap);

  const enriched = useMemo(() => assets.map(a => {
    const ac = (a.currency || "EUR") as Currency;
    const mc = a.kind === "immobilie" && a.mortgage ? mortgageCalc(a.mortgage) : null;
    const effDebt = mc ? mc.outstanding : (a.debt || 0);
    const valueMain = toMain(a.value || 0, ac);
    const debtMain = toMain(effDebt, ac);
    return { a, ac, mc, effDebt, valueMain, debtMain };
  }), [assets, fxMap, main]);

  const grossAssets = enriched.reduce((s, e) => s + e.valueMain, 0);
  const debts = enriched.reduce((s, e) => s + e.debtMain, 0);
  const gross = grossAssets + depotMain;
  const net = gross - debts;

  const pie = useMemo(() => {
    const byKind: Record<string, number> = {};
    assets.forEach(a => { byKind[a.kind] = (byKind[a.kind] || 0) + toMain(a.value || 0, (a.currency || "EUR") as Currency); });
    const slices = KINDS.filter(k => byKind[k] > 0).map(k => ({ name: KIND[k].label, value: Math.round(byKind[k]), color: KIND[k].color }));
    if (depotMain > 0) slices.push({ name: "Depot (Aktien/Krypto)", value: Math.round(depotMain), color: "#FB7185" });
    return slices;
  }, [assets, depot, fxMap, main]);

  const num = (s: string) => parseAmount(s);
  const resetForm = () => { setName(""); setVal(""); setDebt(""); setPrice(""); setEquity(""); setRate("3.8"); setTilgung("2.0"); setStart(""); };

  const add = () => {
    if (kind === "immobilie") {
      const p = num(price); if (!name.trim() || !p) return;
      const mortgage: Mortgage = { price: p, equity: num(equity), ratePct: num(rate), tilgungPct: num(tilgung), start };
      const value = num(val) || p;
      persist([...assets, { id: uid(), name: name.trim(), kind, value, debt: 0, mortgage, currency: aCur }]);
    } else {
      const v = num(val); if (!name.trim() || !v) return;
      persist([...assets, { id: uid(), name: name.trim(), kind, value: v, debt: num(debt), currency: aCur }]);
    }
    resetForm();
  };
  const editVal = (id: string, n: number) => persist(assets.map(a => a.id === id ? { ...a, value: n } : a));
  const editDebt = (id: string, n: number) => persist(assets.map(a => a.id === id ? { ...a, debt: n } : a));
  const remove = (id: string) => persist(assets.filter(a => a.id !== id));

  const payoffText = (months: number) => months === Infinity ? "laeuft nie ab (Rate < Zins)" : months <= 0 ? "abbezahlt" : `noch ca. ${(months / 12).toFixed(1)} Jahre`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <CurrencySelect value={main} onChange={changeMain} label="Anzeige in" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hl p-5"><div className="text-sm text-muted">Nettovermögen</div><div className={`display text-2xl font-bold mt-1 num ${net >= 0 ? "text-gold" : "text-bad"}`}>{ready ? <CountUp value={net} format={eM} /> : "..."}</div><div className="text-[10px] text-muted mt-0.5">Sachwerte + Depot − Schulden</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Sachwerte & Anlagen</div><div className="display text-2xl font-bold mt-1 num text-ink2">{ready ? <CountUp value={gross} format={eM} /> : "..."}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Depot</div><div className="display text-2xl font-bold mt-1 num text-mint">{ready ? <CountUp value={depotMain} format={eM} /> : "..."}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Schulden (Restschuld)</div><div className="display text-2xl font-bold mt-1 num text-bad">{ready ? <CountUp value={debts} format={eM} /> : "..."}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="card p-6">
          <div className="font-semibold display mb-4">Deine Werte</div>
          <div className="space-y-4">
            {enriched.map(({ a, ac, mc, effDebt }) => {
              const k = KIND[a.kind]; const eq = (a.value || 0) - effDebt;
              return (
                <div key={a.id} className="border-b border-line/40 pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{k.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold break-words min-w-0">{a.name}</div>
                        <div className="text-[11px]" style={{ color: k.color }}>{k.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><div className="text-[10px] text-muted">Wert ({ac})</div><input className="input num w-28 text-right py-1.5" defaultValue={a.value} onBlur={e => editVal(a.id, num(e.target.value))} /></div>
                      <button onClick={() => remove(a.id)} className="x-btn">✕</button>
                    </div>
                  </div>

                  {mc && a.mortgage ? (
                    <div className="mt-3 rounded-xl bg-panel2/50 border border-line/50 p-3 space-y-2.5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <Mini label="Kaufpreis" val={fmt(a.mortgage.price, ac)} />
                        <Mini label="Eigenkapital" val={fmt(a.mortgage.equity, ac)} />
                        <Mini label="Darlehen" val={fmt(mc.loan, ac)} />
                        <Mini label="Monatsrate" val={fmt(mc.monthly, ac)} tone="gold" />
                        <Mini label="Restschuld Bank" val={fmt(mc.outstanding, ac)} tone="bad" />
                        <Mini label="Eigenkapital heute" val={fmt(eq, ac)} tone="mint" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm border-t border-line/40 pt-2.5">
                        <Mini label="Bereits gezahlt" val={fmt(mc.paidTotal, ac)} />
                        <Mini label="davon Zinsen" val={fmt(mc.interestPaid, ac)} />
                        <Mini label="davon getilgt" val={fmt(mc.principalPaid, ac)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted pt-1">
                        <span>Zins {a.mortgage.ratePct}% · Tilgung {a.mortgage.tilgungPct}% p.a.</span>
                        <span>Aktuelle Rate: {fmt2(mc.curInterest, ac)} Zins + {fmt2(mc.curTilgung, ac)} Tilgung</span>
                        <span className="text-gold">{payoffText(mc.payoffMonths)}</span>
                      </div>
                    </div>
                  ) : (a.kind === "immobilie" || a.debt > 0) ? (
                    <div className="flex items-center justify-end gap-3 mt-2 text-sm">
                      <span className="text-[11px] text-muted">Restschuld</span>
                      <input className="input num w-28 text-right py-1.5" defaultValue={a.debt} onBlur={e => editDebt(a.id, num(e.target.value))} />
                      <span className="text-[11px] text-muted">Eigenkapital</span>
                      <span className={`num w-24 text-right ${eq >= 0 ? "text-mint" : "text-bad"}`}>{fmt(eq, ac)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {depot > 0 && (
              <div className="flex items-center justify-between gap-3 opacity-90">
                <div className="flex items-center gap-3"><span className="text-xl">📈</span><div><div className="font-semibold">Depot</div></div></div>
                <div className="num text-right w-28 pr-7">{eM(depotMain)}</div>
              </div>
            )}
            {ready && assets.length === 0 && depot === 0 && <div className="text-muted text-sm">Noch keine Werte erfasst.</div>}
          </div>

          <div className="mt-6 border-t border-line/50 pt-5 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {KINDS.map(k => (
                <button key={k} onClick={() => setKind(k)} className="chip" style={kind === k ? { borderColor: KIND[k].color, color: "#fff", background: `${KIND[k].color}1f` } : {}}>
                  {KIND[k].icon} {KIND[k].label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Währung des Eintrags</span>
              <CurrencySelect value={aCur} onChange={setACur} label="" />
            </div>

            {kind === "immobilie" ? (
              <div className="space-y-2">
                <input className="input" placeholder="Bezeichnung (z.B. Eigentumswohnung)" value={name} onChange={e => setName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label={`Kaufpreis (${aCur})`}><input className="input num" placeholder="450000" value={price} onChange={e => setPrice(e.target.value)} /></Field>
                  <Field label={`Aktueller Wert (${aCur}, optional)`}><input className="input num" placeholder="= Kaufpreis" value={val} onChange={e => setVal(e.target.value)} /></Field>
                  <Field label={`Eigenkapital (${aCur})`}><input className="input num" placeholder="90000" value={equity} onChange={e => setEquity(e.target.value)} /></Field>
                  <Field label="Finanzierungsbeginn"><input className="input" type="month" value={start} onChange={e => setStart(e.target.value)} /></Field>
                  <Field label="Sollzins % p.a."><input className="input num" placeholder="3.8" value={rate} onChange={e => setRate(e.target.value)} /></Field>
                  <Field label="anf. Tilgung % p.a."><input className="input num" placeholder="2.0" value={tilgung} onChange={e => setTilgung(e.target.value)} /></Field>
                </div>
                <div className="text-[11px] text-muted">Daraus berechnet die App Monatsrate, Restschuld bei der Bank, bereits gezahlte Zinsen/Tilgung und wann die Immobilie abbezahlt ist.</div>
                <button className="btn w-full" onClick={add}>🏠 Immobilie hinzufügen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className="input" placeholder="Bezeichnung" value={name} onChange={e => setName(e.target.value)} />
                  <input className="input num" placeholder={`Wert (${aCur})`} value={val} onChange={e => setVal(e.target.value)} />
                </div>
                <button className="btn w-full" onClick={add}>{KIND[kind].icon} {KIND[kind].label} hinzufügen</button>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="font-semibold display mb-2">Vermögens-Allokation</div>
          {pie.length > 0 ? (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={56} outerRadius={94} paddingAngle={3} stroke="none">{pie.map((s, i) => <Cell key={i} fill={s.color} />)}</Pie>
                  <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v) => [fmt2(Number(v), main), "Wert"]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8794B0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-muted text-sm py-10 text-center">Füg Werte hinzu, um die Verteilung zu sehen.</div>}
          
        </div>
      </div>
    </div>
  );
}

function Mini({ label, val, tone }: { label: string; val: string; tone?: "gold" | "mint" | "bad" }) {
  const c = tone === "gold" ? "text-gold" : tone === "mint" ? "text-mint" : tone === "bad" ? "text-bad" : "text-ink2";
  return <div><div className="text-[10px] text-muted">{label}</div><div className={`num font-semibold ${c}`}>{val}</div></div>;
}
function Field({ label, children }: { label: string; children: any }) {
  return <div><div className="text-[10px] text-muted mb-1">{label}</div>{children}</div>;
}
