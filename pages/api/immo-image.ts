import type { NextApiRequest, NextApiResponse } from "next";

// Liest aus einem Inserat-Screenshot/Foto die Eckdaten per Anthropic Vision.
// Bild wird als base64 (JPEG/PNG/WebP) im Body erwartet. Key nur serverseitig.

export const config = { api: { bodyParser: { sizeLimit: "16mb" } } };

const ENDPOINT = "https://api.anthropic.com/v1/messages";

const PROMPT = [
  "You are extracting structured data from one or more real-estate listing images (expose pages, energy certificate, photos).",
  "Combine information across ALL provided images. Return ONLY a compact JSON object, no markdown, no prose, with these keys:",
  '{"price": number|null, "size": number|null, "rooms": number|null, "location": string|null, "currency": "EUR"|"CHF"|null, "country": "DE"|"CH"|null, "yearBuilt": number|null, "heating": string|null, "energy": string|null, "pv": boolean|null, "condition": string|null}',
  "Rules: price = purchase/sale price as integer in the listing currency (ignore monthly rent/fees; pick the main asking price).",
  "size = living area in m2. rooms = number of rooms. location = postal code + city if visible.",
  "currency: CHF if Swiss, else EUR. country: CH or DE.",
  "yearBuilt = construction year (Baujahr) as a 4-digit number if visible.",
  "heating = short German label of heating type if visible (e.g. 'Waermepumpe', 'Gas', 'Oel', 'Fernwaerme', 'Pellets').",
  "energy = short German energy info if visible (e.g. energy class 'A+', or consumption like '85 kWh/m2a', or 'Energieklasse C').",
  "pv = true if photovoltaic/solar is mentioned, false if clearly none, null if unknown.",
  "condition = short German label of state if derivable (e.g. 'neuwertig', 'gepflegt', 'renovierungsbeduerftig', 'sanierungsbeduerftig').",
  "Use null for anything not clearly visible. Do not guess.",
].join(" ");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, warning: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, warning: "ANTHROPIC_API_KEY fehlt (in Vercel fuer Production eintragen)." });

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const body = req.body as { image?: string; images?: string[]; media_type?: string };
  const list = (body.images && body.images.length ? body.images : (body.image ? [body.image] : [])).slice(0, 6);
  if (!list.length) return res.status(200).json({ ok: false, warning: "Kein Bild empfangen." });

  const mt = (body.media_type || "image/jpeg").toLowerCase();
  const imgBlocks = list.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: mt, data: img.includes(",") ? (img.split(",").pop() as string) : img },
  }));

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages: [{ role: "user", content: [...imgBlocks, { type: "text", text: PROMPT }] }],
      }),
    });
    const out = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, warning: out?.error?.message || "Anthropic-Fehler." });

    const text = (out.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(clean); } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }

    const price = typeof parsed.price === "number" ? parsed.price : null;
    const ok = price != null && price > 0;
    return res.status(200).json({
      ok,
      price: price || undefined,
      size: typeof parsed.size === "number" ? parsed.size : undefined,
      rooms: typeof parsed.rooms === "number" ? parsed.rooms : undefined,
      location: parsed.location || undefined,
      currency: parsed.currency === "CHF" || parsed.currency === "EUR" ? parsed.currency : undefined,
      country: parsed.country === "CH" || parsed.country === "DE" ? parsed.country : undefined,
      yearBuilt: typeof parsed.yearBuilt === "number" ? parsed.yearBuilt : undefined,
      heating: parsed.heating || undefined,
      energy: parsed.energy || undefined,
      pv: typeof parsed.pv === "boolean" ? parsed.pv : undefined,
      condition: parsed.condition || undefined,
      count: list.length,
      warning: ok ? undefined : "Im Bild keinen Preis erkannt - bitte Werte manuell eintragen oder weitere Bilder hinzufuegen.",
    });
  } catch (e: any) {
    return res.status(200).json({ ok: false, warning: e?.message || "Serverfehler bei der Bildauswertung." });
  }
}
