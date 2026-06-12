import { useEffect, useMemo, useState } from "react";
import { Currency, Goal, Asset, fmt, convertCur, getFxMap, loadSettings, loadGoals, saveGoals, loadAssets, saveAssets, uid, parseAmount } from "../lib/store";
import CurrencySelect from "./CurrencySelect";

const GREST: Record<string, number> = {
  "Baden-Württemberg": 5.0, "Bayern": 3.5, "Berlin": 6.0, "Brandenburg": 6.5, "Bremen": 5.0,
  "Hamburg": 5.5, "Hessen": 6.0, "Mecklenburg-Vorpommern": 6.0, "Niedersachsen": 5.0,
  "Nordrhein-Westfalen": 6.5, "Rheinland-Pfalz": 5.0, "Saarland": 6.5, "Sachsen": 5.5,
  "Sachsen-Anhalt": 5.0, "Schleswig-Holstein": 6.5, "Thüringen": 5.0,
};
const KANTON: Record<string, number> = {
  "Aargau": 1.0, "Basel-Landschaft": 2.5, "Basel-Stadt": 2.5, "Zürich": 0.4, "Zug": 0.5,
  "Bern": 1.8, "Luzern": 1.8, "St. Gallen": 1.0, "Solothurn": 2.2, "Waadt": 3.3, "Genf": 3.3,
};

type Land = "DE" | "CH" | "VS";
const num = (s: string) => parseAmount(s);

export default function Immobilien() {
  const [fxMap, setFxMap] = useState<Record<string, number>>({ EUR: 1, USD: 0.92, CHF: 1.05 });
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [loc, setLoc] = useState("");
  const [actMsg, setActMsg] = useState("");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  const [land, setLand] = useState<Land>("VS");
  const [price, setPrice] = useState("750000");
  const [cur, setCur] = useState<Currency>("CHF");
  const [equity, setEquity] = useState("200000");
  const [income, setIncome] = useState("120000");      // Brutto-Jahreseinkommen CHF (fuer CH-Tragbarkeit)

  const [bundesland, setBundesland] = useState("Baden-Württemberg");
  const [grestPct, setGrestPct] = useState("5.0");
  const [maklerPct, setMaklerPct] = useState("3.57");
  const [deZins, setDeZins] = useState("3.5");
  const [deTilgung, setDeTilgung] = useState("2.0");

  const [kanton, setKanton] = useState("Aargau");
  const [chNebenPct, setChNebenPct] = useState("1.0");
  const [chZins, setChZins] = useState("2.0");

  useEffect(() => { getFxMap(["EUR", "CHF", "USD"]).then(setFxMap); loadSettings().then(s => setCur(s.mainCurrency)); }, []);

  const conv = (n: number, to: Currency) => convertCur(n, cur, to, fxMap);

  const loadInserat = async () => {
    if (!link.trim()) return;
    setLoading(true); setLoadMsg("");
    try {
      const r = await fetch(`/api/immo?url=${encodeURIComponent(link.trim())}`).then(x => x.json());
      if (r.currency) setCur(r.currency);
      if (r.country === "CH") setLand("CH"); else if (r.country === "DE") setLand("DE");
      if (r.price) setPrice(String(r.price));
      if (r.location) setLoc(String(r.location)); else if (r.title) setLoc(String(r.title).slice(0, 60));
      setLoadMsg(r.ok
        ? `Gefunden: ${r.title ? r.title + " - " : ""}${r.price ? fmt(r.price, r.currency) : ""}${r.size ? " - " + r.size + " m²" : ""}${r.location ? " - " + r.location : ""}`
        : (r.warning || "Nichts gefunden."));
    } catch {
      setLoadMsg("Konnte das Inserat nicht laden.");
    }
    setLoading(false);
  };

  const onImage = async (file: File | undefined | null) => {
    if (!file) return;
    setImgBusy(true); setLoadMsg("Bild wird ausgewertet…");
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("read"));
        fr.readAsDataURL(file);
      });
      // herunterskalieren (max 1400px Breite) -> kleines JPEG
      const small: string = await new Promise((resolve) => {
        const im = new Image();
        im.onload = () => {
          const maxW = 1400; const scale = Math.min(1, maxW / im.width);
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
          const ctx = c.getContext("2d"); if (ctx) ctx.drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        im.onerror = () => resolve(dataUrl);
        im.src = dataUrl;
      });
      const r = await fetch("/api/immo-image", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: small, media_type: "image/jpeg" }),
      }).then(x => x.json());
      if (r.currency) setCur(r.currency);
      if (r.country === "CH") setLand("CH"); else if (r.country === "DE") setLand("DE");
      if (r.price) setPrice(String(r.price));
      if (r.location) setLoc(String(r.location).slice(0, 60));
      setLoadMsg(r.ok
        ? `Aus Bild gelesen: ${fmt(r.price, r.currency || cur)}${r.size ? " - " + r.size + " m²" : ""}${r.location ? " - " + r.location : ""}`
        : (r.warning || "Im Bild nichts erkannt."));
    } catch {
      setLoadMsg("Bild konnte nicht ausgewertet werden.");
    }
    setImgBusy(false);
  };

  const parseFromText = () => {
    const t = paste.replace(/\u00A0/g, " ");
    if (!t.trim()) return;
    const isCH = /\bCHF\b|\bFr\.?\b/i.test(t) && !/\u20AC|\bEUR\b/i.test(t);
    const ccy: Currency = isCH ? "CHF" : (/\u20AC|\bEUR\b/i.test(t) ? "EUR" : cur);
    // alle waehrungsnahen Zahlen sammeln, groesste = Preis
    const cands: number[] = [];
    const re = /(?:CHF|EUR|\u20AC|Fr\.?)\s*([0-9][0-9'\u2019.,\s]{3,})|([0-9][0-9'\u2019.,]{4,})\s*(?:CHF|EUR|\u20AC|\.[\u2013-])/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) { const raw = (m[1] || m[2] || "").replace(/[\s\u00A0]/g, ""); const v = num(raw); if (v >= 1000) cands.push(v); }
    const p = cands.length ? Math.max(...cands) : 0;
    const sm = t.match(/([0-9]{2,4})\s*m(?:2|\u00B2)/i);
    const plz = t.match(/\b([0-9]{4,5})\s+([A-Za-z\u00C0-\u017F.\- ]{2,30})/);
    if (p) setPrice(String(p));
    if (ccy) setCur(ccy);
    if (plz) setLoc(`${plz[1]} ${plz[2].trim()}`.slice(0, 60));
    setLoadMsg(p
      ? `Aus Text gelesen: ${fmt(p, ccy)}${sm ? " - " + sm[1] + " m²" : ""}${plz ? " - " + plz[1] + " " + plz[2].trim() : ""}`
      : "Im Text keinen Preis gefunden - bitte Kaufpreis manuell eintragen.");
  };

  const setBl = (b: string) => { setBundesland(b); setGrestPct(String(GREST[b])); };
  const setKt = (k: string) => { setKanton(k); setChNebenPct(String(KANTON[k])); };

  const flash = (m: string) => { setActMsg(m); setTimeout(() => setActMsg(""), 2600); };
  const monthNow = () => new Date().toISOString().slice(0, 7);

  const goalFrom = async (land2: "DE" | "CH") => {
    const isDE = land2 === "DE";
    const target = isDE ? de.neben + de.p * 0.20 : ch.minEK + ch.neben;
    const current = isDE ? de.ek : ch.ek;
    const ccy: Currency = isDE ? "EUR" : "CHF";
    const g: Goal = {
      id: uid(),
      title: `Eigenkapital ${isDE ? "Immobilie DE" : "Immobilie CH"}${loc ? " - " + loc : ""}`,
      timeframe: "jahr", category: "Immobilie", done: current >= target,
      target: Math.round(target), current: Math.round(current), currency: ccy,
      createdTs: Date.now(),
    };
    const ex = await loadGoals(); await saveGoals([g, ...ex]);
    flash(`Sparziel angelegt: ${fmt(g.target!, ccy)} Eigenkapital (Stand ${fmt(g.current!, ccy)}). Im Tab "Ziele".`);
  };

  const assetFrom = async (land2: "DE" | "CH") => {
    const isDE = land2 === "DE";
    const ccy: Currency = isDE ? "EUR" : "CHF";
    const p = isDE ? de.p : ch.p;
    const ek = isDE ? de.ek : ch.ek;
    const ratePct = isDE ? num(deZins) : num(chZins);
    const tilgungPct = isDE ? num(deTilgung) : (ch.hypothek > 0 ? Math.max(0.5, ch.amortJahr / ch.hypothek * 100) : 1);
    const a: Asset = {
      id: uid(), name: loc || (isDE ? "Immobilie DE" : "Immobilie CH"), kind: "immobilie",
      value: Math.round(p), debt: 0, currency: ccy,
      mortgage: { price: Math.round(p), equity: Math.round(ek), ratePct, tilgungPct: Math.round(tilgungPct * 10) / 10, start: monthNow() },
    };
    const ex = await loadAssets(); await saveAssets([...ex, a]);
    flash(`In Vermögen übernommen: ${a.name} (${fmt(a.value, ccy)}). Im Tab "Vermögen".`);
  };

  const de = useMemo(() => {
    const p = conv(num(price), "EUR");
    const ek = conv(num(equity), "EUR");
    const grest = p * num(grestPct) / 100;
    const notar = p * 1.5 / 100;
    const grundbuch = p * 0.5 / 100;
    const makler = p * num(maklerPct) / 100;
    const neben = grest + notar + grundbuch + makler;
    const gesamt = p + neben;
    const darlehen = Math.max(0, gesamt - ek);
    const rate = darlehen * (num(deZins) + num(deTilgung)) / 100 / 12;
    const beleihung = p > 0 ? darlehen / p * 100 : 0;
    return { p, ek, grest, notar, grundbuch, makler, neben, gesamt, darlehen, rate, beleihung, ekDeckt: ek >= neben };
  }, [price, equity, cur, fxMap, grestPct, maklerPct, deZins, deTilgung]);

  const ch = useMemo(() => {
    const p = conv(num(price), "CHF");
    const ek = conv(num(equity), "CHF");
    const inc = num(income);
    const minEK = p * 0.20;
    const hypothek = Math.max(0, p - ek);
    const belehnung = p > 0 ? hypothek / p * 100 : 0;
    const hyp1 = Math.min(hypothek, p * 2 / 3);
    const hyp2 = Math.max(0, hypothek - p * 2 / 3);
    const amortJahr = hyp2 / 15;
    const neben = p * num(chNebenPct) / 100;
    const kalkZins = hypothek * 0.05;
    const unterhalt = p * 0.01;
    const kostenJahr = kalkZins + unterhalt + amortJahr;
    const quote = inc > 0 ? kostenJahr / inc * 100 : 0;
    const zinsMonat = hypothek * num(chZins) / 100 / 12;
    return { p, ek, minEK, hypothek, belehnung, hyp1, hyp2, amortJahr, neben, kalkZins, unterhalt, kostenJahr, quote, zinsMonat, ekOK: ek >= minEK, tragbar: inc > 0 && quote <= 33.34 };
  }, [price, equity, income, cur, fxMap, chNebenPct, chZins]);

  return (
    <div className="space-y-5">
      {/* Inserat laden */}
      <div className="card p-6 space-y-3">
        <div className="font-semibold display">Inserat-Link (optional)</div>
        <div className="flex gap-2 flex-wrap">
          <input className="input flex-1 min-w-[200px]" placeholder="https://www.homegate.ch/... oder immobilienscout24.de/..." value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => e.key === "Enter" && loadInserat()} />
          <button className="btn" onClick={loadInserat} disabled={loading || !link.trim()}>{loading ? "Lade..." : "Laden"}</button>
        </div>
        <label className={`btn-ghost rounded-xl px-4 py-2 text-sm cursor-pointer inline-flex items-center gap-2 w-fit ${imgBusy ? "opacity-60 pointer-events-none" : ""}`}>
          {imgBusy ? "Lese Bild…" : "📷 Screenshot/Foto auswerten"}
          <input type="file" accept="image/*" className="hidden" onChange={e => onImage(e.target.files?.[0])} />
        </label>
        {loadMsg && <div className="text-xs text-muted">{loadMsg}</div>}
        <div className="text-[11px] text-muted">Viele Portale blockieren automatische Zugriffe. Klappt der Link nicht, nutze „Text einfügen" — das funktioniert immer.</div>
        <button onClick={() => setShowPaste(v => !v)} className="text-[11px] text-mint hover:underline text-left">{showPaste ? "Texteingabe ausblenden" : "Stattdessen Inseratstext einfügen"}</button>
        {showPaste && (
          <div className="space-y-2 pt-1">
            <textarea className="input" rows={4} placeholder="Inserat öffnen, Beschreibung/Preis markieren, kopieren und hier einfügen…" value={paste} onChange={e => setPaste(e.target.value)} />
            <button className="btn" onClick={parseFromText} disabled={!paste.trim()}>Aus Text lesen</button>
          </div>
        )}
      </div>

      {/* Eckdaten */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold display">Eckdaten</div>
          <div className="inline-flex p-0.5 rounded-xl bg-panel2/60 border border-line">
            {([["DE", "Deutschland"], ["CH", "Schweiz"], ["VS", "Vergleich"]] as [Land, string][]).map(([id, lbl]) => (
              <button key={id} onClick={() => setLand(id)} className="px-3 py-1 rounded-lg text-xs font-semibold transition" style={land === id ? { background: "#F5B544", color: "#0B1020" } : { color: "#8794B0" }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Kaufpreis">
            <div className="flex items-center gap-2">
              <input className="input num flex-1" value={price} onChange={e => setPrice(e.target.value)} />
              <CurrencySelect value={cur} onChange={setCur} label="" />
            </div>
            <div className="text-[10px] text-muted mt-1 num">= {fmt(num(price), cur)}</div>
          </Field>
          <Field label="Eigenkapital"><input className="input num" value={equity} onChange={e => setEquity(e.target.value)} /><div className="text-[10px] text-muted mt-1 num">= {fmt(num(equity), cur)}</div></Field>
          <Field label="Brutto-Jahreseinkommen (CHF, für CH)"><input className="input num" value={income} onChange={e => setIncome(e.target.value)} /><div className="text-[10px] text-muted mt-1 num">= {fmt(num(income), "CHF")}</div></Field>
        </div>
      </div>

      {/* DE Parameter */}
      {(land === "DE" || land === "VS") && (
        <div className="card p-5 space-y-3">
          <div className="font-semibold text-sm" style={{ color: "#F5B544" }}>Deutschland — Parameter</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Bundesland">
              <select className="input" value={bundesland} onChange={e => setBl(e.target.value)}>
                {Object.keys(GREST).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Grunderwerbst. %"><input className="input num" value={grestPct} onChange={e => setGrestPct(e.target.value)} /></Field>
            <Field label="Makler %"><input className="input num" value={maklerPct} onChange={e => setMaklerPct(e.target.value)} /></Field>
            <Field label="Sollzins %"><input className="input num" value={deZins} onChange={e => setDeZins(e.target.value)} /></Field>
            <Field label="Tilgung %"><input className="input num" value={deTilgung} onChange={e => setDeTilgung(e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* CH Parameter */}
      {(land === "CH" || land === "VS") && (
        <div className="card p-5 space-y-3">
          <div className="font-semibold text-sm" style={{ color: "#5EEAD4" }}>Schweiz — Parameter</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Kanton">
              <select className="input" value={kanton} onChange={e => setKt(e.target.value)}>
                {Object.keys(KANTON).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Kaufnebenkosten % (ca.)"><input className="input num" value={chNebenPct} onChange={e => setChNebenPct(e.target.value)} /></Field>
            <Field label="Hypothekarzins %"><input className="input num" value={chZins} onChange={e => setChZins(e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* Ergebnisse */}
      {actMsg && <div className="card-hl card p-3 text-sm text-mint">{actMsg}</div>}
      <div className={`grid gap-4 ${land === "VS" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {(land === "DE" || land === "VS") && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold display">🇩🇪 Deutschland</div>
              <div className="text-xs text-muted num">Beleihung {de.beleihung.toFixed(0)}%</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Cell label="Grunderwerbsteuer" val={fmt(de.grest, "EUR")} />
              <Cell label="Notar + Grundbuch" val={fmt(de.notar + de.grundbuch, "EUR")} />
              <Cell label="Maklerprovision" val={fmt(de.makler, "EUR")} />
              <Cell label="Kaufnebenkosten" val={fmt(de.neben, "EUR")} tone="bad" />
              <Cell label="Gesamtkosten" val={fmt(de.gesamt, "EUR")} />
              <Cell label="Darlehen" val={fmt(de.darlehen, "EUR")} />
              <Cell label="Monatsrate (Zins+Tilgung)" val={fmt(de.rate, "EUR")} tone="gold" wide />
            </div>
            {!de.ekDeckt && <div className="text-[11px] text-bad">⚠ Dein Eigenkapital deckt die Kaufnebenkosten nicht — deutsche Banken finanzieren diese i. d. R. nicht mit.</div>}
            <div className="text-[10px] text-muted">Nebenkosten = Grunderwerbsteuer ({grestPct}%) + Notar/Grundbuch (2,0%) + Makler ({maklerPct}%).</div>
            <div className="flex gap-2 pt-1">
              <button className="chip flex-1" onClick={() => goalFrom("DE")}>🎯 Als Sparziel</button>
              <button className="chip flex-1" onClick={() => assetFrom("DE")}>🏠 In Vermögen</button>
            </div>
          </div>
        )}

        {(land === "CH" || land === "VS") && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold display">🇨🇭 Schweiz</div>
              <div className="text-xs num" style={{ color: ch.tragbar ? "#5EEAD4" : "#FB7185" }}>Tragbarkeit {ch.quote.toFixed(0)}%</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Cell label="Mind. Eigenkapital (20%)" val={fmt(ch.minEK, "CHF")} tone={ch.ekOK ? "mint" : "bad"} />
              <Cell label="Hypothek" val={fmt(ch.hypothek, "CHF")} />
              <Cell label="1. Hypothek (bis 66%)" val={fmt(ch.hyp1, "CHF")} />
              <Cell label="2. Hypothek (amort.)" val={fmt(ch.hyp2, "CHF")} />
              <Cell label="Amortisation / Jahr" val={fmt(ch.amortJahr, "CHF")} />
              <Cell label="Kaufnebenkosten" val={fmt(ch.neben, "CHF")} tone="bad" />
              <Cell label="Zinskosten / Monat" val={fmt(ch.zinsMonat, "CHF")} tone="gold" />
              <Cell label="Kalk. Kosten / Jahr" val={fmt(ch.kostenJahr, "CHF")} wide />
            </div>
            {!ch.ekOK && <div className="text-[11px] text-bad">⚠ Mindestens 20% Eigenkapital nötig (davon ≥10% nicht aus der Pensionskasse).</div>}
            {ch.ekOK && !ch.tragbar && <div className="text-[11px] text-bad">⚠ Tragbarkeit über 33% — Banken rechnen mit kalkulatorisch 5% Zins + 1% Unterhalt + Amortisation.</div>}
            {ch.ekOK && ch.tragbar && <div className="text-[11px] text-mint">✓ Tragbarkeit erfüllt (Faustregel ≤ 33% des Bruttoeinkommens).</div>}
            <div className="text-[10px] text-muted">Kalk. Kosten = 5% kalkulatorischer Zins auf die Hypothek + 1% Unterhalt + Amortisation der 2. Hypothek.</div>
            <div className="flex gap-2 pt-1">
              <button className="chip flex-1" onClick={() => goalFrom("CH")}>🎯 Als Sparziel</button>
              <button className="chip flex-1" onClick={() => assetFrom("CH")}>🏠 In Vermögen</button>
            </div>
          </div>
        )}
      </div>

      <div className="text-[11px] text-muted px-1">Vereinfachte Schätzung. Steuersätze (Bundesland/Kanton), Bankregeln und Zinsen variieren. Im Vergleichsmodus wird der Preis über aktuelle Wechselkurse in EUR bzw. CHF umgerechnet.</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] text-muted mb-1">{label}</div>{children}</div>;
}
function Cell({ label, val, tone, wide }: { label: string; val: string; tone?: "gold" | "mint" | "bad"; wide?: boolean }) {
  const c = tone === "gold" ? "#F5B544" : tone === "mint" ? "#5EEAD4" : tone === "bad" ? "#FB7185" : "#E7ECF5";
  return (
    <div className={`rounded-xl bg-panel2/50 border border-line p-3 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className="num font-semibold mt-0.5" style={{ color: c }}>{val}</div>
    </div>
  );
}
