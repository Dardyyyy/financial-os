import { useEffect, useRef, useState } from "react";
import {
  Msg, SavedNote, loadChats, saveChats, loadNotes, saveNotes,
  loadTransactions, loadHoldings, uid, eur,
} from "../lib/store";

const MODES = {
  investment: { label: "Investment", icon: "📈", color: "#F5B544",
    system: "Du bist ein nüchterner Investment-Analyst mit Fokus auf KI-Infrastruktur und Energie. Antworte auf Deutsch, strukturiert und konkret. Nenne Chancen UND Risiken (Bull/Bear). Keine personalisierte Anlageberatung; Entscheidungen liegen beim Nutzer." },
  debt: { label: "Schulden", icon: "💳", color: "#FB7185",
    system: "Du bist ein empathischer Schuldenberater. Antworte auf Deutsch. Priorisiere Schulden (Lawine vs. Schneeball), erstelle realistische Abbaupläne, erkläre Optionen sachlich." },
  tax: { label: "Steuer", icon: "🧾", color: "#5EEAD4",
    system: "Du bist ein Steuer-Erklärer für Privatpersonen. Antworte auf Deutsch, verständlich und mit konkretem Bezug zur Gesetzeslage des angegebenen Landes (Deutschland ODER Schweiz). Beachte Unterschiede z.B. bei Kapitalertragsteuer/Verrechnungssteuer, Freibeträgen und Fristen. Du ersetzt keinen Steuerberater und sagst das auch." },
  budget: { label: "Budget", icon: "📊", color: "#A78BFA",
    system: "Du bist ein praktischer Budget-Coach. Antworte auf Deutsch. Gib konkrete, umsetzbare Tipps zu Sparquoten, 50/30/20 und Cashflow." },
} as const;
type ModeId = keyof typeof MODES;

export default function ExpertAdvisor() {
  const [mode, setMode] = useState<ModeId>("investment");
  const [country, setCountry] = useState<"DE" | "CH">("DE");
  const [chats, setChats] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [ctx, setCtx] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats().then(setChats);
    loadNotes().then(setNotes);
    Promise.all([loadTransactions(), loadHoldings()]).then(([txs, holds]) => {
      const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const bal = income - expense;
      const rate = income > 0 ? Math.round((bal / income) * 100) : 0;
      const cat = new Map<string, number>();
      txs.filter(t => t.amount < 0).forEach(t => cat.set(t.category, (cat.get(t.category) || 0) + Math.abs(t.amount)));
      const top = Array.from(cat, ([n, v]) => `${n} ${eur(v)}`).slice(0, 4).join(", ");
      const depot = holds.map(h => `${h.ticker} ${h.shares} Stk`).join(", ");
      setCtx(`FINANZDATEN DES NUTZERS (für persönliche, konkrete Beratung; nicht ungefragt vorlesen):\n- Einnahmen/Monat: ${eur(income)}\n- Ausgaben/Monat: ${eur(expense)}\n- Bilanz: ${eur(bal)} (Sparquote ~${rate}%)\n- Top-Ausgaben: ${top || "–"}\n- Depot: ${depot || "–"}`);
    });
  }, []);

  const thread = chats[mode] || [];

  const send = async () => {
    const text = input.trim(); if (!text || loading) return;
    setError("");
    const next = [...thread, { role: "user" as const, content: text }];
    const updated = { ...chats, [mode]: next };
    setChats(updated); saveChats(updated); setInput(""); setLoading(true);
    const system = `${MODES[mode].system}\n\nLand für Steuer-/Rechtsfragen: ${country === "DE" ? "Deutschland" : "Schweiz"}.\n\n${ctx}`;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, system }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      const done = { ...updated, [mode]: [...next, { role: "assistant" as const, content: data.text }] };
      setChats(done); saveChats(done);
      setTimeout(() => boxRef.current?.scrollTo(0, boxRef.current.scrollHeight), 50);
    } catch (e: any) {
      setError(e.message); setChats(chats); setInput(text);
    } finally { setLoading(false); }
  };

  const pin = (text: string) => {
    const n = [{ id: uid(), mode: MODES[mode].label, label: text.slice(0, 60), text, ts: Date.now() }, ...notes];
    setNotes(n); saveNotes(n);
  };
  const unpin = (id: string) => { const n = notes.filter(x => x.id !== id); setNotes(n); saveNotes(n); };
  const clearThread = () => { const u = { ...chats, [mode]: [] }; setChats(u); saveChats(u); };

  const m = MODES[mode];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(MODES) as ModeId[]).map(id => (
            <button key={id} onClick={() => setMode(id)} className="chip" style={mode === id ? { background: `${MODES[id].color}22`, borderColor: MODES[id].color, color: "#fff" } : {}}>
              <span className="mr-1">{MODES[id].icon}</span>{MODES[id].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted">Land:</span>
          <button onClick={() => setCountry("DE")} className="chip" style={country === "DE" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>🇩🇪 DE</button>
          <button onClick={() => setCountry("CH")} className="chip" style={country === "CH" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>🇨🇭 CH</button>
        </div>
      </div>

      {/* Aktiver-Modus-Banner: macht den Wechsel sichtbar */}
      <div className="flex items-center justify-between rounded-xl px-4 py-2.5 border" style={{ borderColor: `${m.color}55`, background: `${m.color}12` }}>
        <div className="text-sm"><span className="mr-2">{m.icon}</span><b style={{ color: m.color }}>{m.label}-Berater</b> <span className="text-muted">· {country === "DE" ? "Deutschland" : "Schweiz"} · kennt deine Finanzdaten</span></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNotes(s => !s)} className="text-xs text-muted hover:text-ink2">📌 Gespeichert ({notes.length})</button>
          {thread.length > 0 && <button onClick={clearThread} className="text-xs text-muted hover:text-bad">Verlauf leeren</button>}
        </div>
      </div>

      {showNotes && (
        <div className="card p-4 space-y-2">
          <div className="font-semibold display text-sm">Gespeicherte Infos</div>
          {notes.length === 0 && <div className="text-muted text-xs">Noch nichts gespeichert. Tippe bei einer Antwort auf „📌 Speichern".</div>}
          {notes.map(n => (
            <div key={n.id} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2">
              <div className="min-w-0"><div className="text-[11px] text-gold">{n.mode} · {new Date(n.ts).toLocaleDateString("de-DE")}</div><div className="text-sm whitespace-pre-wrap">{n.text}</div></div>
              <button onClick={() => unpin(n.id)} className="text-muted hover:text-bad text-sm shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="card card-hl flex flex-col" style={{ height: "58vh", minHeight: 400 }}>
        <div ref={boxRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {thread.length === 0 && <div className="text-muted text-sm max-w-md">Frag den <b style={{ color: m.color }}>{m.label}-Berater</b> etwas. Er kennt deine Einnahmen, Ausgaben und dein Depot — also ruhig konkret fragen, z.B. „Wo kann ich diesen Monat am meisten sparen?"</div>}
          {thread.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${msg.role === "user" ? "text-ink font-medium" : "bg-panel2 border border-line"}`} style={msg.role === "user" ? { background: m.color } : {}}>{msg.content}</div>
                {msg.role === "assistant" && <button onClick={() => pin(msg.content)} className="text-[11px] text-muted hover:text-gold mt-1 ml-1">📌 Speichern</button>}
              </div>
            </div>
          ))}
          {loading && <div className="text-muted text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ background: m.color }} />denkt nach…</div>}
        </div>
        <div className="border-t border-line/60 p-4">
          {error && <div className="text-bad text-xs mb-2">⚠ {error}</div>}
          <div className="flex gap-2">
            <input className="input" placeholder="Deine Frage…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
            <button className="btn" onClick={send} disabled={loading || !input.trim()}>Senden</button>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted">Keine Anlage-, Steuer- oder Rechtsberatung im rechtlichen Sinn.</div>
    </div>
  );
}
