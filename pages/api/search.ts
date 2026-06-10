import type { NextApiRequest, NextApiResponse } from "next";

// Suche fuer Aktien (Finnhub) und Krypto (CoinGecko).
//   Aktie:  /api/search?q=nvidia
//   Krypto: /api/search?q=ethereum&type=crypto   -> { results:[{symbol,name,cgId}] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = String(req.query.q || "").trim();
  const type = String(req.query.type || "stock");
  if (!q) return res.status(200).json({ results: [] });

  if (type === "crypto") {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      const d = await r.json();
      const results = (d.coins || []).slice(0, 10).map((c: any) => ({
        symbol: String(c.symbol || "").toUpperCase(), name: c.name, cgId: c.id,
      }));
      return res.status(200).json({ results });
    } catch (e: any) { return res.status(200).json({ results: [], warning: "Krypto-Suche fehlgeschlagen." }); }
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ results: [], warning: "FINNHUB_API_KEY fehlt (in Vercel für Production eintragen + Redeploy)." });
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
    if (!r.ok) return res.status(200).json({ results: [], warning: `Finnhub-Fehler ${r.status} (Key/Production prüfen).` });
    const d = await r.json();
    const raw = (d.result || []).map((x: any) => ({ symbol: x.symbol as string, name: (x.description || x.symbol) as string }));
    const usFirst = raw.filter((x: any) => x.symbol && !x.symbol.includes("."));
    return res.status(200).json({ results: (usFirst.length ? usFirst : raw).slice(0, 10) });
  } catch (e: any) { return res.status(200).json({ results: [], warning: "Suche fehlgeschlagen." }); }
}
