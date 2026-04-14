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
    const { firstUserMessage, firstAIResponse } = req.body;
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 16,
      system: "Generate a concise 3-5 word title for this conversation. Return only the title, no quotes, no punctuation at the end.",
      messages: [{
        role: "user",
        content: `User: "${String(firstUserMessage).slice(0, 300)}"\nAI: "${String(firstAIResponse).slice(0, 200)}"`,
      }],
    });

    const block = response.content.find((b) => b.type === "text");
    const title = block?.type === "text" ? block.text.trim() : String(firstUserMessage).slice(0, 40);
    res.json({ title });
  } catch (err: any) {
    console.error("Title generation error:", err);
    res.status(500).json({ error: err.message ?? "Unknown error" });
  }
}
