import type { NextApiRequest, NextApiResponse } from "next";

// Aktiensuche nach Name/Ticker via Finnhub.  /api/search?q=siemens
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(200).json({ results: [] });
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ results: [], warning: "FINNHUB_API_KEY fehlt (in Vercel für Production eintragen + Redeploy)." });
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
    if (!r.ok) return res.status(200).json({ results: [], warning: `Finnhub-Fehler ${r.status} (Key/Rate-Limit prüfen).` });
    const d = await r.json();
    const raw = (d.result || []).map((x: any) => ({ symbol: x.symbol as string, name: (x.description || x.symbol) as string }));
    const usFirst = raw.filter((x: any) => x.symbol && !x.symbol.includes("."));
    const list = (usFirst.length ? usFirst : raw).slice(0, 10);
    return res.status(200).json({ results: list });
  } catch (e: any) {
    return res.status(200).json({ results: [], warning: "Suche fehlgeschlagen: " + (e?.message || "unbekannt") });
  }
}
