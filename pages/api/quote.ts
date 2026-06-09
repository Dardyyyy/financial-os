import type { NextApiRequest, NextApiResponse } from "next";

// Liefert aktuelle Kurse.
//   Aktien:  /api/quote?type=stock&symbols=NBIS,CRWV     (braucht FINNHUB_API_KEY)
//   Krypto:  /api/quote?type=crypto&ids=bitcoin,ethereum (CoinGecko, kein Key noetig)
// Antwort:   { prices: { NBIS: 48.12, ... } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const type = String(req.query.type || "stock");

  try {
    if (type === "crypto") {
      const ids = String(req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!ids.length) return res.status(200).json({ prices: {} });
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur`;
      const r = await fetch(url);
      const data = await r.json();
      const prices: Record<string, number> = {};
      for (const id of ids) if (data[id]?.eur != null) prices[id] = data[id].eur;
      return res.status(200).json({ prices });
    }

    // Aktien via Finnhub
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return res.status(200).json({
        prices: {},
        warning: "FINNHUB_API_KEY fehlt. Trage ihn in den Environment Variables ein, um Live-Aktienkurse zu laden.",
      });
    }
    const symbols = String(req.query.symbols || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!symbols.length) return res.status(200).json({ prices: {} });

    const prices: Record<string, number> = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`);
        const q = await r.json();
        if (q && typeof q.c === "number" && q.c > 0) prices[sym] = q.c; // c = current price
      } catch { /* einzelne Fehler ignorieren */ }
    }));

    return res.status(200).json({ prices });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Quote-Fehler", prices: {} });
  }
}
