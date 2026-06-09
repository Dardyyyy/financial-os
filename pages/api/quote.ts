import type { NextApiRequest, NextApiResponse } from "next";

// Liefert Kurse und Wechselkurse.
//   Aktien:  /api/quote?type=stock&symbols=NBIS,CRWV   (FINNHUB_API_KEY)
//            -> { prices:{SYM:price}, changes:{SYM:pct}, currency:"USD" }
//   Krypto:  /api/quote?type=crypto&ids=bitcoin        (CoinGecko, EUR, kein Key)
//   FX:      /api/quote?type=fx&from=USD&to=EUR        (frankfurter.app, kein Key)
//            -> { rate }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const type = String(req.query.type || "stock");

  try {
    if (type === "fx") {
      const from = String(req.query.from || "USD");
      const to = String(req.query.to || "EUR");
      try {
        const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
        const d = await r.json();
        const rate = d?.rates?.[to];
        if (rate) return res.status(200).json({ rate });
      } catch { /* fallback unten */ }
      try {
        const r2 = await fetch(`https://open.er-api.com/v6/latest/${from}`);
        const d2 = await r2.json();
        const rate2 = d2?.rates?.[to];
        if (rate2) return res.status(200).json({ rate: rate2 });
      } catch { /* ignore */ }
      return res.status(200).json({ rate: null, warning: "Wechselkurs nicht verfuegbar." });
    }

    if (type === "crypto") {
      const ids = String(req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
      if (!ids.length) return res.status(200).json({ prices: {} });
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur`;
      const r = await fetch(url);
      const data = await r.json();
      const prices: Record<string, number> = {};
      for (const id of ids) if (data[id]?.eur != null) prices[id] = data[id].eur;
      return res.status(200).json({ prices, currency: "EUR" });
    }

    // Aktien via Finnhub
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return res.status(200).json({
        prices: {}, changes: {}, currency: "USD",
        warning: "FINNHUB_API_KEY fehlt. Trage ihn in den Environment Variables ein, um Live-Aktienkurse zu laden.",
      });
    }
    const symbols = String(req.query.symbols || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!symbols.length) return res.status(200).json({ prices: {}, changes: {} });

    const prices: Record<string, number> = {};
    const changes: Record<string, number> = {};
    await Promise.all(symbols.map(async (sym) => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`);
        const q = await r.json();
        if (q && typeof q.c === "number" && q.c > 0) {
          prices[sym] = q.c;                 // current price
          if (typeof q.dp === "number") changes[sym] = q.dp; // percent change today
        }
      } catch { /* einzelne Fehler ignorieren */ }
    }));

    return res.status(200).json({ prices, changes, currency: "USD" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Quote-Fehler", prices: {}, changes: {} });
  }
}
