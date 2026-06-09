import { useEffect, useRef, useState } from "react";
import {
  Msg, SavedNote, ChatSession, loadChats, saveChats, loadNotes, saveNotes,
  loadTransactions, loadHoldings, uid, eur,
} from "../lib/store";

const MODES = {
  investment: { label: "Investment", icon: "📈", color: "#F5B544",
    system: "Du bist ein nüchterner Investment-Analyst mit Fokus auf KI-Infrastruktur und Energie. Antworte auf Deutsch, strukturiert und konkret. Nenne Chancen UND Risiken. Keine personalisierte Anlageberatung." },
  debt: { label: "Schulden", icon: "💳", color: "#FB7185",
    system: "Du bist ein empathischer Schuldenberater. Antworte auf Deutsch. Priorisiere Schulden (Lawine vs. Schneeball), erstelle realistische Abbaupläne." },
  tax: { label: "Steuer", icon: "🧾", color: "#5EEAD4",
    system: "Du bist ein Steuer-Erklärer für Privatpersonen. Antworte auf Deutsch mit konkretem Bezug zur Gesetzeslage des angegebenen Landes (Deutschland ODER Schweiz). Beachte Unterschiede bei Kapitalertrag-/Verrechnungssteuer, Freibeträgen, Fristen. Du ersetzt keinen Steuerberater." },
  budget: { label: "Budget", icon: "📊", color: "#A78BFA",
    system: "Du bist ein praktischer Budget-Coach. Antworte auf Deutsch mit konkreten, umsetzbaren Tipps zu Sparquoten und Cashflow." },
} as const;
type ModeId = keyof typeof MODES;

const newSession = (): ChatSession => ({ id: uid(), title: "Neuer Chat", mode: "investment", country: "DE", messages: [], ts: Date.now() });

export default function ExpertAdvisor() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [ctx, setCtx] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats().then((list) => {
      if (list && list.length) { setSessions(list); setActiveId(list[0].id); }
      else { const s = newSession(); setSessions([s]); setActiveId(s.id); }
    });
    loadNotes().then(setNotes);
    Promise.all([loadTransactions(), loadHoldings()]).then(([txs, holds]) => {
      const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const bal = income - expense, rate = income > 0 ? Math.round((bal / income) * 100) : 0;
      const cat = new Map<string, number>();
      txs.filter(t => t.amount < 0).forEach(t => cat.set(t.category, (cat.get(t.category) || 0) + Math.abs(t.amount)));
      const top = Array.from(cat, ([n, v]) => `${n} ${eur(v)}`).slice(0, 4).join(", ");
      const depot = holds.map(h => `${h.ticker} ${h.shares} Stk`).join(", ");
      setCtx(`FINANZDATEN DES NUTZERS (für persönliche Beratung; nicht ungefragt vorlesen):\n- Einnahmen/Monat: ${eur(income)}\n- Ausgaben/Monat: ${eur(expense)}\n- Bilanz: ${eur(bal)} (Sparquote ~${rate}%)\n- Top-Ausgaben: ${top || "–"}\n- Depot: ${depot || "–"}`);
    });
  }, []);

  const active = sessions.find(s => s.id === activeId);
  const persist = (next: ChatSession[]) => { setSessions(next); saveChats(next); };
  const patchActive = (patch: Partial<ChatSession>) => persist(sessions.map(s => s.id === activeId ? { ...s, ...patch } : s));

  const addChat = () => { const s = newSession(); persist([s, ...sessions]); setActiveId(s.id); };
  const delChat = (id: string) => {
    const next = sessions.filter(s => s.id !== id);
    if (next.length === 0) { const s = newSession(); persist([s]); setActiveId(s.id); return; }
    persist(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const send = async () => {
    const text = input.trim(); if (!text || loading || !active) return;
    setError("");
    const msgs = [...active.messages, { role: "user" as const, content: text }];
    const title = active.messages.length === 0 ? text.slice(0, 32) : active.title;
    const updated = sessions.map(s => s.id === activeId ? { ...s, messages: msgs, title } : s);
    persist(updated); setInput(""); setLoading(true);
    const m = MODES[active.mode as ModeId];
    const system = `${m.system}\n\nLand für Steuer-/Rechtsfragen: ${active.country === "DE" ? "Deutschland" : "Schweiz"}.\n\n${ctx}`;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs, system }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler");
      persist(updated.map(s => s.id === activeId ? { ...s, messages: [...msgs, { role: "assistant", content: data.text }] } : s));
      setTimeout(() => boxRef.current?.scrollTo(0, boxRef.current.scrollHeight), 50);
    } catch (e: any) { setError(e.message); setInput(text); }
    finally { setLoading(false); }
  };

  const pin = (text: string) => {
    if (!active) return;
    const n = [{ id: uid(), mode: MODES[active.mode as ModeId].label, label: text.slice(0, 60), text, ts: Date.now() }, ...notes];
    setNotes(n); saveNotes(n);
  };
  const unpin = (id: string) => { const n = notes.filter(x => x.id !== id); setNotes(n); saveNotes(n); };

  if (!active) return <div className="text-muted text-sm">Lädt…</div>;
  const m = MODES[active.mode as ModeId];

  return (
    <div className="space-y-4">
      {/* Chat-Sessions */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={addChat} className="btn-ghost px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0">＋ Neuer Chat</button>
        {sessions.map(s => (
          <div key={s.id} onClick={() => setActiveId(s.id)}
            className={`chip flex items-center gap-2 whitespace-nowrap shrink-0 ${s.id === activeId ? "" : "opacity-70"}`}
            style={s.id === activeId ? { borderColor: "#F5B544", color: "#fff" } : {}}>
            <span className="max-w-[140px] truncate">{s.title}</span>
            <button onClick={(e) => { e.stopPropagation(); delChat(s.id); }} className="text-muted hover:text-bad">✕</button>
          </div>
        ))}
      </div>

      {/* Modus + Land (pro Chat) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(MODES) as ModeId[]).map(id => (
            <button key={id} onClick={() => patchActive({ mode: id })} className="chip"
              style={active.mode === id ? { background: `${MODES[id].color}22`, borderColor: MODES[id].color, color: "#fff" } : {}}>
              <span className="mr-1">{MODES[id].icon}</span>{MODES[id].label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted">Land:</span>
          <button onClick={() => patchActive({ country: "DE" })} className="chip" style={active.country === "DE" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>🇩🇪 DE</button>
          <button onClick={() => patchActive({ country: "CH" })} className="chip" style={active.country === "CH" ? { borderColor: "#F5B544", color: "#F5B544" } : {}}>🇨🇭 CH</button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl px-4 py-2.5 border" style={{ borderColor: `${m.color}55`, background: `${m.color}12` }}>
        <div className="text-sm"><span className="mr-2">{m.icon}</span><b style={{ color: m.color }}>{m.label}-Berater</b> <span className="text-muted">· {active.country === "DE" ? "Deutschland" : "Schweiz"} · kennt deine Finanzdaten</span></div>
        <button onClick={() => setShowNotes(s => !s)} className="text-xs text-muted hover:text-ink2">📌 Gespeichert ({notes.length})</button>
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

      <div className="card card-hl flex flex-col" style={{ height: "54vh", minHeight: 380 }}>
        <div ref={boxRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {active.messages.length === 0 && <div className="text-muted text-sm max-w-md">Frag den <b style={{ color: m.color }}>{m.label}-Berater</b> etwas. Er kennt deine Einnahmen, Ausgaben und dein Depot — z.B. „Wo kann ich diesen Monat am meisten sparen?"</div>}
          {active.messages.map((msg, i) => (
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
