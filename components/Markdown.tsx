import React from "react";

// Hübscher, robuster Markdown-Renderer für KI-Antworten.
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={`${keyBase}-b${i++}`} className="font-semibold text-white">{m[2]}</strong>);
    else if (m[3] !== undefined) out.push(<em key={`${keyBase}-i${i++}`} className="italic text-ink2">{m[3]}</em>);
    else if (m[4] !== undefined) out.push(<code key={`${keyBase}-c${i++}`} className="num text-mint bg-black/30 rounded px-1.5 py-0.5 text-[0.9em]">{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, accent = "#F5B544" }: { text: string; accent?: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] | null = null;
  let key = 0;

  const flush = () => {
    if (list) {
      const items = list.items;
      blocks.push(list.ordered
        ? <ol key={`l${key++}`} className="space-y-1.5 my-2">{items.map((it, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="num text-[12px] font-semibold mt-[1px] shrink-0" style={{ color: accent }}>{j + 1}.</span>
              <span className="flex-1 leading-relaxed">{inline(it, `o${key}-${j}`)}</span>
            </li>))}</ol>
        : <ul key={`l${key++}`} className="space-y-1.5 my-2">{items.map((it, j) => (
            <li key={j} className="flex gap-2.5">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: accent }} />
              <span className="flex-1 leading-relaxed">{inline(it, `u${key}-${j}`)}</span>
            </li>))}</ul>);
      list = null;
    }
    if (quote) {
      blocks.push(<blockquote key={`q${key++}`} className="border-l-2 pl-3 my-2 text-muted italic" style={{ borderColor: accent }}>{inline(quote.join(" "), `q${key}`)}</blockquote>);
      quote = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    // Trennlinie statt roher Striche (---, ***, ___)
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flush();
      blocks.push(<div key={`hr${key++}`} className="h-px my-3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const bh = line.match(/^\*\*([^*]+):\*\*\s*$/); // **Fazit:** als kleine Überschrift
    const ul = line.match(/^\s*[-*•–—]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const bq = line.match(/^\s*>\s?(.*)$/);

    if (h) {
      flush();
      const level = h[1].length;
      const txt = inline(h[2].replace(/:$/, ""), `h${key}`);
      if (level <= 1) blocks.push(<div key={`h${key++}`} className="display font-bold text-[17px] mt-3 mb-1.5" style={{ color: accent }}>{txt}</div>);
      else if (level === 2) blocks.push(
        <div key={`h${key++}`} className="mt-3 mb-1.5">
          <div className="display font-semibold text-[15px]" style={{ color: accent }}>{txt}</div>
          <div className="h-px mt-1.5" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)" }} />
        </div>);
      else blocks.push(<div key={`h${key++}`} className="display font-semibold text-[12.5px] uppercase tracking-wide mt-2.5 mb-1" style={{ color: accent, opacity: 0.92 }}>{txt}</div>);
    }
    else if (bh) { flush(); blocks.push(<div key={`bh${key++}`} className="display font-semibold text-[14px] mt-2.5 mb-1" style={{ color: accent }}>{inline(bh[1], `bh${key}`)}</div>); }
    else if (bq) { if (!quote) { flush(); quote = []; } quote.push(bq[1]); }
    else if (ul) { if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; } list.items.push(ul[1]); }
    else if (ol) { if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; } list.items.push(ol[1]); }
    else { flush(); blocks.push(<p key={`p${key++}`} className="leading-relaxed">{inline(line, `p${key}`)}</p>); }
  }
  flush();
  return <div className="space-y-1.5 text-sm text-ink2/90">{blocks}</div>;
}
