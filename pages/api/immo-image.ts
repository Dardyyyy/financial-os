import type { NextApiRequest, NextApiResponse } from "next";

// Liest aus einem Inserat-Screenshot/Foto die Eckdaten per Anthropic Vision.
// Bild wird als base64 (JPEG/PNG/WebP) im Body erwartet. Key nur serverseitig.

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const ENDPOINT = "https://api.anthropic.com/v1/messages";

const PROMPT = [
  "You are extracting structured data from a real-estate listing screenshot.",
  "Return ONLY a compact JSON object, no markdown, no prose, with these keys:",
  '{"price": number|null, "size": number|null, "rooms": number|null, "location": string|null, "currency": "EUR"|"CHF"|null, "country": "DE"|"CH"|null}',
  "Rules: price is the purchase/sale price as an integer in the listing currency (ignore monthly rent, fees, or extra costs; pick the main asking price).",
  "size is living area in square meters as a number. rooms is number of rooms.",
  "location is postal code + city if visible. currency: CHF if Swiss (CHF/Fr.), else EUR.",
  "country: CH for Swiss listings, DE for German listings. Use null for anything not clearly visible.",
].join(" ");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, warning: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, warning: "ANTHROPIC_API_KEY fehlt (in Vercel fuer Production eintragen)." });

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const { image, media_type } = req.body as { image?: string; media_type?: string };
  if (!image) return res.status(200).json({ ok: false, warning: "Kein Bild empfangen." });

  const mt = (media_type || "image/jpeg").toLowerCase();
  const data = image.includes(",") ? image.split(",").pop() as string : image; // data-URL-Prefix entfernen

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mt, data } },
            { type: "text", text: PROMPT },
          ],
        }],
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
      warning: ok ? undefined : "Im Bild keinen Preis erkannt - bitte Werte manuell eintragen.",
    });
  } catch (e: any) {
    return res.status(200).json({ ok: false, warning: e?.message || "Serverfehler bei der Bildauswertung." });
  }
}
