import type { NextApiRequest, NextApiResponse } from "next";

// Suche: Aktien via Finnhub (Key noetig), Krypto via CoinGecko (kein Key).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = String(req.query.q || "").trim();
  const type = String(req.query.type || "stock");
  if (!q) return res.status(200).json({ results: [] });

  if (type === "crypto") {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
      if (!r.ok) {
        const w = r.status === 429 ? "CoinGecko Rate-Limit (429). Kurz warten." : `CoinGecko-Fehler ${r.status}.`;
        return res.status(200).json({ results: [], warning: w });
      }
      const d = await r.json();
      const results = (d.coins || []).slice(0, 12).map((c: any) => ({ symbol: String(c.symbol || "").toUpperCase(), name: c.name, cgId: c.id, rank: c.market_cap_rank ?? null }));
      return res.status(200).json({ results });
    } catch { return res.status(200).json({ results: [], warning: "Krypto-Suche fehlgeschlagen." }); }
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ results: [], warning: "FINNHUB_API_KEY fehlt (in Vercel fuer Production eintragen + Redeploy)." });
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`);
    if (!r.ok) return res.status(200).json({ results: [], warning: `Finnhub-Fehler ${r.status} (Key/Production pruefen).` });
    const d = await r.json();
    const raw = (d.result || []).map((x: any) => ({ symbol: x.symbol as string, name: (x.description || x.symbol) as string }));
    const usFirst = raw.filter((x: any) => x.symbol && !x.symbol.includes("."));
    return res.status(200).json({ results: (usFirst.length ? usFirst : raw).slice(0, 12) });
  } catch { return res.status(200).json({ results: [], warning: "Suche fehlgeschlagen." }); }
}
