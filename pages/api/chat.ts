import type { NextApiRequest, NextApiResponse } from "next";

// Server-seitiger Proxy zur Anthropic API.
// Der API-Key liegt NUR als Environment Variable (ANTHROPIC_API_KEY) auf dem Server
// und ist im Browser niemals sichtbar.

const ENDPOINT = "https://api.anthropic.com/v1/messages";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY fehlt. Trage ihn in .env.local (lokal) bzw. in den Vercel Environment Variables ein.",
    });
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const { messages, system } = req.body as { messages: ChatMessage[]; system?: string };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages fehlt oder ist leer." });
  }

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: system || undefined,
        messages,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "Anthropic API Fehler.",
      });
    }

    const text = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    return res.status(200).json({ text });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unbekannter Serverfehler." });
  }
}
