import type { NextApiRequest, NextApiResponse } from "next";

// Kurse + Wechselkurse. Aktien via Finnhub (Key noetig), Krypto via CoinGecko (kein Key).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const type = String(req.query.type || "stock");
  try {
    if (type === "fx") {
      const from = String(req.query.from || "USD");
      const to = String(req.query.to || "EUR");
      try { const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`); const d = await r.json(); if (d?.rates?.[to]) return res.status(200).json({ rate: d.rates[to] }); } catch {}
      try { const r = await fetch(`https://open.er-api.com/v6/latest/${from}`); const d = await r.json(); if (d?.rates?.[to]) return res.status(200).json({ rate: d.rates[to] }); } catch {}
      return res.status(200).json({ rate: null });
    }

    if (type === "crypto") {
      const ids = String(req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!ids.length) return res.status(200).json({ prices: {} });
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur`);
      if (!r.ok) {
        const w = r.status === 429 ? "CoinGecko Rate-Limit (429). Kurz warten und erneut versuchen." : `CoinGecko-Fehler ${r.status}.`;
        return res.status(200).json({ prices: {}, currency: "EUR", warning: w });
      }
      const data = await r.json();
      const prices: Record<string, number> = {};
      for (const id of ids) if (data[id]?.eur != null) prices[id] = data[id].eur;
      return res.status(200).json({ prices, currency: "EUR" });
    }

    const key = process.env.FINNHUB_API_KEY;
    if (!key) return res.status(200).json({ prices: {}, changes: {}, currency: "USD", warning: "FINNHUB_API_KEY fehlt (in Vercel fuer Production eintragen + Redeploy)." });

    const symbols = String(req.query.symbols || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!symbols.length) return res.status(200).json({ prices: {}, changes: {} });

    const prices: Record<string, number> = {};
    const changes: Record<string, number> = {};
    let diag = "";
    await Promise.all(symbols.map(async (sym) => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`);
        if (!r.ok) {
          if (r.status === 401) diag = "Finnhub-Key ungueltig (401). In Vercel pruefen: exakt der Key, keine Leerzeichen, Production aktiv.";
          else if (r.status === 429) diag = "Finnhub Rate-Limit erreicht (429). Kurz warten und erneut aktualisieren.";
          else if (r.status === 403) diag = "Finnhub: Zugriff verweigert (403).";
          else diag = `Finnhub-Fehler ${r.status}.`;
          return;
        }
        const q = await r.json();
        if (q && typeof q.c === "number" && q.c > 0) { prices[sym] = q.c; if (typeof q.dp === "number") changes[sym] = q.dp; }
      } catch { diag = "Netzwerkfehler zu Finnhub."; }
    }));

    const out: any = { prices, changes, currency: "USD" };
    if (Object.keys(prices).length === 0 && diag) out.warning = diag;
    return res.status(200).json(out);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Quote-Fehler", prices: {}, changes: {} });
  }
}
