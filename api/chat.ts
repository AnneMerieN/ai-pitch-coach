import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const client = new Anthropic({ apiKey });

  try {
    const { model, max_tokens, system, messages } = req.body;
    const response = await client.messages.create({ model, max_tokens, system, messages });
    res.json(response);
  } catch (err: any) {
    console.error("Anthropic error:", err);
    res.status(500).json({ error: err.message ?? "Unknown error" });
  }
}
