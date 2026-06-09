import type { NextApiRequest, NextApiResponse } from "next";

// Aktiensuche nach Name/Ticker via Finnhub.  /api/search?q=siemens
// -> { results: [{ symbol, name }] }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(200).json({ results: [] });
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ results: [], warning: "Suche braucht FINNHUB_API_KEY." });
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
    const d = await r.json();
    const results = (d.result || [])
      .filter((x: any) => x.symbol && !x.symbol.includes(".")) // bevorzugt US-Symbole (Finnhub free)
      .slice(0, 8)
      .map((x: any) => ({ symbol: x.symbol, name: x.description || x.symbol }));
    return res.status(200).json({ results });
  } catch (e: any) {
    return res.status(200).json({ results: [], error: e?.message });
  }
}
