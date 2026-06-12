import React from "react";

// Leichter Markdown-Renderer fuer schoene Chat-Antworten (Ueberschriften, Listen, Fett, Absaetze).
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // **fett** und `code`
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={`${keyBase}-b${i++}`} className="text-ink2 font-semibold">{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<code key={`${keyBase}-c${i++}`} className="num text-mint bg-black/30 rounded px-1 py-0.5 text-[0.92em]">{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, accent = "#F5B544" }: { text: string; accent?: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flush = () => {
    if (!list) return;
    const items = list.items;
    blocks.push(list.ordered
      ? <ol key={`l${key++}`} className="list-decimal pl-5 space-y-1 my-1.5 marker:text-muted">{items.map((it, j) => <li key={j}>{inline(it, `o${key}-${j}`)}</li>)}</ol>
      : <ul key={`l${key++}`} className="space-y-1 my-1.5">{items.map((it, j) => <li key={j} className="flex gap-2"><span style={{ color: accent }} className="mt-[2px]">•</span><span className="flex-1">{inline(it, `u${key}-${j}`)}</span></li>)}</ul>);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) { flush(); blocks.push(<div key={`h${key++}`} className="display font-semibold text-[15px] mt-2 mb-1" style={{ color: accent }}>{inline(h[2], `h${key}`)}</div>); }
    else if (ul) { if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; } list.items.push(ul[1]); }
    else if (ol) { if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; } list.items.push(ol[1]); }
    else { flush(); blocks.push(<p key={`p${key++}`} className="leading-relaxed">{inline(line, `p${key}`)}</p>); }
  }
  flush();
  return <div className="space-y-1.5 text-sm">{blocks}</div>;
}
