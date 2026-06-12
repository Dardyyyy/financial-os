import type { NextApiRequest, NextApiResponse } from "next";

// Best-effort Inserat-Parser. Viele Portale blocken Bots oder rendern per JS -
// dann liefern wir ok:false + warning, der Nutzer traegt manuell ein.

type Out = {
  ok: boolean;
  price?: number;
  size?: number;
  rooms?: number;
  location?: string;
  title?: string;
  currency?: "EUR" | "CHF";
  country?: "DE" | "CH";
  source?: string;
  warning?: string;
};

const num = (s: string): number => {
  // entfernt Tausendertrenner ' . , Leerzeichen, behaelt nur Ziffern
  const clean = s.replace(/[^0-9]/g, "");
  return clean ? parseInt(clean, 10) : 0;
};

function deep(obj: any, want: string[], depth = 0): any {
  if (!obj || depth > 6) return undefined;
  if (typeof obj !== "object") return undefined;
  for (const k of Object.keys(obj)) {
    if (want.includes(k.toLowerCase())) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const r = deep(obj[k], want, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Out>) {
  const url = String(req.query.url || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    res.status(200).json({ ok: false, warning: "Bitte einen vollstaendigen Link mit https:// angeben." });
    return;
  }

  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { host = ""; }
  const isCH = /\.ch$|homegate|comparis|immoscout24\.ch|newhome|flatfox/.test(host);
  const country: "DE" | "CH" = isCH ? "CH" : "DE";
  const currency: "EUR" | "CHF" = isCH ? "CHF" : "EUR";

  let html = "";
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(to);
    if (!r.ok) {
      res.status(200).json({ ok: false, country, currency, source: host, warning: "Portal hat den Zugriff blockiert (Status " + r.status + "). Bitte Werte manuell eintragen." });
      return;
    }
    html = await r.text();
  } catch (e: any) {
    res.status(200).json({ ok: false, country, currency, source: host, warning: "Konnte das Inserat nicht laden (Timeout/Blockade). Bitte Werte manuell eintragen." });
    return;
  }

  let price = 0, size = 0, rooms = 0, location = "", title = "";

  // 1) JSON-LD bevorzugen
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const m = b.match(/>([\s\S]*?)<\/script>/i);
    if (!m) continue;
    try {
      const data = JSON.parse(m[1].trim());
      const arr = Array.isArray(data) ? data : [data];
      for (const node of arr) {
        const p = deep(node, ["price"]);
        if (!price && p) price = num(String(p));
        const fs = deep(node, ["floorsize", "size"]);
        if (!size && fs) { const v = typeof fs === "object" ? deep(fs, ["value"]) : fs; if (v) size = num(String(v)); }
        const nm = deep(node, ["name"]);
        if (!title && typeof nm === "string") title = nm.slice(0, 120);
        const addr = deep(node, ["address"]);
        if (!location && addr) {
          if (typeof addr === "string") location = addr.slice(0, 120);
          else { const loc = deep(addr, ["addresslocality", "locality"]); const pc = deep(addr, ["postalcode"]); location = [pc, loc].filter(Boolean).join(" ").slice(0, 120); }
        }
      }
    } catch { /* ignore */ }
  }

  // 2) OpenGraph als Fallback
  const og = (prop: string) => {
    const m = html.match(new RegExp('<meta[^>]+property=["\']' + prop + '["\'][^>]+content=["\']([^"\']+)', "i"));
    return m ? m[1] : "";
  };
  if (!title) title = (og("og:title") || "").slice(0, 120);
  const ogDesc = og("og:description") || "";
  const ogPrice = og("product:price:amount") || og("og:price:amount");
  if (!price && ogPrice) price = num(ogPrice);

  // 3) Regex-Fallback im Text
  const text = (title + " " + ogDesc + " " + html.replace(/<[^>]+>/g, " ")).replace(/&nbsp;/g, " ");
  if (!price) {
    // CHF 1'250'000  /  1.250.000 EUR  /  1 250 000
    const pm = text.match(/(?:CHF|EUR|\u20AC)\s*([0-9][0-9'.,\s]{4,})/i) || text.match(/([0-9][0-9'.,\s]{5,})\s*(?:CHF|EUR|\u20AC)/i);
    if (pm) price = num(pm[1]);
  }
  if (!size) {
    const sm = text.match(/([0-9]{2,4})\s*m(?:2|\u00B2)\b/i);
    if (sm) size = num(sm[1]);
  }
  const rm = text.match(/([0-9](?:[.,][05])?)\s*(?:Zimmer|Zi\.|rooms?)/i);
  if (rm) rooms = parseFloat(rm[1].replace(",", ".")) || 0;

  const ok = price > 0;
  res.status(200).json({
    ok,
    price: price || undefined,
    size: size || undefined,
    rooms: rooms || undefined,
    location: location || undefined,
    title: title || undefined,
    currency, country, source: host,
    warning: ok ? undefined : "Preis nicht automatisch gefunden - bitte manuell eintragen (Portal rendert evtl. per JavaScript).",
  });
}
