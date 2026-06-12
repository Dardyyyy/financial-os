import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Asset, AssetKind, Mortgage, loadAssets, saveAssets, loadHoldings, getUsdEur, eur, eur2, uid } from "../lib/store";
import CountUp from "./CountUp";

const KIND: Record<AssetKind, { label: string; icon: string; color: string }> = {
  immobilie:   { label: "Immobilie",       icon: "🏠", color: "#F5B544" },
  bargeld:     { label: "Bargeld / Konto",  icon: "💶", color: "#5EEAD4" },
  edelmetall:  { label: "Edelmetall",       icon: "🥇", color: "#FBBF24" },
  beteiligung: { label: "Beteiligung",      icon: "🏢", color: "#A78BFA" },
  sonstiges:   { label: "Sonstiges",        icon: "📦", color: "#60A5FA" },
};
const KINDS = Object.keys(KIND) as AssetKind[];

function monthsSince(start: string) {
  if (!start) return 0;
  const [y, m] = start.split("-").map(Number);
  if (!y || !m) return 0;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
}

// Deutsche Annuitaeten-Finanzierung durchrechnen
function mortgageCalc(mo: Mortgage) {
  const loan = Math.max(0, (mo.price || 0) - (mo.equity || 0));
  const mRate = (mo.ratePct || 0) / 100 / 12;
  const monthly = loan * ((mo.ratePct || 0) + (mo.tilgungPct || 0)) / 100 / 12;
  const elapsed = monthsSince(mo.start);
  let bal = loan, interestPaid = 0, principalPaid = 0;
  for (let i = 0; i < elapsed && bal > 0.005; i++) {
    const int = bal * mRate; let pr = monthly - int;
    if (pr < 0) pr = 0; if (pr > bal) pr = bal;
    bal -= pr; interestPaid += int; principalPaid += pr;
  }
  let rem = 0; let b2 = bal;
  if (monthly > b2 * mRate + 0.001) { while (b2 > 0.005 && rem < 1200) { const int = b2 * mRate; let pr = monthly - int; if (pr > b2) pr = b2; b2 -= pr; rem++; } }
  else rem = Infinity;
  const curInterest = bal * mRate;
  const curTilgung = Math.max(0, monthly - curInterest);
  return { loan, monthly, outstanding: bal, interestPaid, principalPaid, paidTotal: (mo.equity || 0) + principalPaid + interestPaid, payoffMonths: rem, elapsed, curInterest, curTilgung };
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [depot, setDepot] = useState(0);

  const [kind, setKind] = useState<AssetKind>("immobilie");
  const [name, setName] = useState(""); const [val, setVal] = useState(""); const [debt, setDebt] = useState("");
  const [price, setPrice] = useState(""); const [equity, setEquity] = useState("");
  const [rate, setRate] = useState("3.8"); const [tilgung, setTilgung] = useState("2.0");
  const [start, setStart] = useState("");

  useEffect(() => {
    loadAssets().then(a => { setAssets(a); setReady(true); });
    (async () => {
      const [h, fx] = await Promise.all([loadHoldings(), getUsdEur()]);
      setDepot(h.reduce((s, x) => s + x.shares * x.lastPrice * (x.currency === "USD" ? fx : 1), 0));
    })();
  }, []);
  const persist = (a: Asset[]) => { setAssets(a); saveAssets(a); };

  const enriched = useMemo(() => assets.map(a => {
    const mc = a.kind === "immobilie" && a.mortgage ? mortgageCalc(a.mortgage) : null;
    const effDebt = mc ? mc.outstanding : (a.debt || 0);
    return { a, mc, effDebt };
  }), [assets]);

  const grossAssets = enriched.reduce((s, e) => s + (e.a.value || 0), 0);
  const debts = enriched.reduce((s, e) => s + e.effDebt, 0);
  const gross = grossAssets + depot;
  const net = gross - debts;

  const pie = useMemo(() => {
    const byKind: Record<string, number> = {};
    assets.forEach(a => { byKind[a.kind] = (byKind[a.kind] || 0) + (a.value || 0); });
    const slices = KINDS.filter(k => byKind[k] > 0).map(k => ({ name: KIND[k].label, value: Math.round(byKind[k]), color: KIND[k].color }));
    if (depot > 0) slices.push({ name: "Depot (Aktien/Krypto)", value: Math.round(depot), color: "#FB7185" });
    return slices;
  }, [assets, depot]);

  const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;
  const resetForm = () => { setName(""); setVal(""); setDebt(""); setPrice(""); setEquity(""); setRate("3.8"); setTilgung("2.0"); setStart(""); };

  const add = () => {
    if (kind === "immobilie") {
      const p = num(price); if (!name.trim() || !p) return;
      const mortgage: Mortgage = { price: p, equity: num(equity), ratePct: num(rate), tilgungPct: num(tilgung), start };
      const value = num(val) || p;
      persist([...assets, { id: uid(), name: name.trim(), kind, value, debt: 0, mortgage }]);
    } else {
      const v = num(val); if (!name.trim() || !v) return;
      persist([...assets, { id: uid(), name: name.trim(), kind, value: v, debt: num(debt) }]);
    }
    resetForm();
  };
  const editVal = (id: string, n: number) => persist(assets.map(a => a.id === id ? { ...a, value: n } : a));
  const editDebt = (id: string, n: number) => persist(assets.map(a => a.id === id ? { ...a, debt: n } : a));
  const remove = (id: string) => persist(assets.filter(a => a.id !== id));

  const payoffText = (months: number) => months === Infinity ? "laeuft nie ab (Rate < Zins)" : months <= 0 ? "abbezahlt" : `noch ca. ${(months / 12).toFixed(1)} Jahre`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hl p-5"><div className="text-sm text-muted">Nettovermögen</div><div className={`display text-2xl font-bold mt-1 num ${net >= 0 ? "text-gold" : "text-bad"}`}>{ready ? <CountUp value={net} format={eur} /> : "..."}</div><div className="text-[10px] text-muted mt-0.5">Sachwerte + Depot − Schulden</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Sachwerte & Anlagen</div><div className="display text-2xl font-bold mt-1 num text-ink2">{ready ? <CountUp value={gross} format={eur} /> : "..."}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Depot (aus Portfolio)</div><div className="display text-2xl font-bold mt-1 num text-mint">{ready ? <CountUp value={depot} format={eur} /> : "..."}</div></div>
        <div className="card p-5"><div className="text-sm text-muted">Schulden (Restschuld)</div><div className="display text-2xl font-bold mt-1 num text-bad">{ready ? <CountUp value={debts} format={eur} /> : "..."}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <div className="card p-6">
          <div className="font-semibold display mb-4">Deine Werte</div>
          <div className="space-y-4">
            {enriched.map(({ a, mc, effDebt }) => {
              const k = KIND[a.kind]; const eq = (a.value || 0) - effDebt;
              return (
                <div key={a.id} className="border-b border-line/40 pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{k.icon}</span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.name}</div>
                        <div className="text-[11px]" style={{ color: k.color }}>{k.label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right"><div className="text-[10px] text-muted">Wert</div><input className="input num w-28 text-right py-1.5" defaultValue={a.value} onBlur={e => editVal(a.id, num(e.target.value))} /></div>
                      <button onClick={() => remove(a.id)} className="text-muted hover:text-bad">✕</button>
                    </div>
                  </div>

                  {mc && a.mortgage ? (
                    <div className="mt-3 rounded-xl bg-panel2/50 border border-line/50 p-3 space-y-2.5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <Mini label="Kaufpreis" val={eur(a.mortgage.price)} />
                        <Mini label="Eigenkapital" val={eur(a.mortgage.equity)} />
                        <Mini label="Darlehen" val={eur(mc.loan)} />
                        <Mini label="Monatsrate" val={eur(mc.monthly)} tone="gold" />
                        <Mini label="Restschuld Bank" val={eur(mc.outstanding)} tone="bad" />
                        <Mini label="Eigenkapital heute" val={eur(eq)} tone="mint" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm border-t border-line/40 pt-2.5">
                        <Mini label="Bereits gezahlt" val={eur(mc.paidTotal)} />
                        <Mini label="davon Zinsen" val={eur(mc.interestPaid)} />
                        <Mini label="davon getilgt" val={eur(mc.principalPaid)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted pt-1">
                        <span>Zins {a.mortgage.ratePct}% · Tilgung {a.mortgage.tilgungPct}% p.a.</span>
                        <span>Aktuelle Rate: {eur2(mc.curInterest)} Zins + {eur2(mc.curTilgung)} Tilgung</span>
                        <span className="text-gold">{payoffText(mc.payoffMonths)}</span>
                      </div>
                    </div>
                  ) : (a.kind === "immobilie" || a.debt > 0) ? (
                    <div className="flex items-center justify-end gap-3 mt-2 text-sm">
                      <span className="text-[11px] text-muted">Restschuld</span>
                      <input className="input num w-28 text-right py-1.5" defaultValue={a.debt} onBlur={e => editDebt(a.id, num(e.target.value))} />
                      <span className="text-[11px] text-muted">Eigenkapital</span>
                      <span className={`num w-24 text-right ${eq >= 0 ? "text-mint" : "text-bad"}`}>{eur(eq)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {depot > 0 && (
              <div className="flex items-center justify-between gap-3 opacity-90">
                <div className="flex items-center gap-3"><span className="text-xl">📈</span><div><div className="font-semibold">Depot</div><div className="text-[11px] text-bad">Aktien & Krypto · aus Portfolio</div></div></div>
                <div className="num text-right w-28 pr-7">{eur(depot)}</div>
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

            {kind === "immobilie" ? (
              <div className="space-y-2">
                <input className="input" placeholder="Bezeichnung (z.B. Eigentumswohnung)" value={name} onChange={e => setName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kaufpreis (€)"><input className="input num" placeholder="450000" value={price} onChange={e => setPrice(e.target.value)} /></Field>
                  <Field label="Aktueller Wert (€, optional)"><input className="input num" placeholder="= Kaufpreis" value={val} onChange={e => setVal(e.target.value)} /></Field>
                  <Field label="Eigenkapital (€)"><input className="input num" placeholder="90000" value={equity} onChange={e => setEquity(e.target.value)} /></Field>
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
                  <input className="input num" placeholder="Wert (€)" value={val} onChange={e => setVal(e.target.value)} />
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
                  <Tooltip contentStyle={{ background: "#0C1322", border: "1px solid #F5B544", borderRadius: 12 }} labelStyle={{ color: "#F5B544" }} itemStyle={{ color: "#fff", fontFamily: "var(--font-mono)" }} formatter={(v) => [eur2(Number(v)), "Wert"]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8794B0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-muted text-sm py-10 text-center">Füg Werte hinzu, um die Verteilung zu sehen.</div>}
          <div className="text-[11px] text-muted mt-2">Restschuld wird vom Nettovermögen abgezogen, zählt aber nicht zur Allokation.</div>
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
