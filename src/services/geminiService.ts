import Anthropic from "@anthropic-ai/sdk";
import type { AIResponse, ConversationTurn, PitchLength } from "../types";
import type { ProcessedFile } from "../utils/fileProcessor";

// In development: call Anthropic directly (key from .env.local).
// In production (Vercel): call our secure serverless proxy — key never leaves the server.
const IS_PROD = import.meta.env.PROD;

const devClient = IS_PROD
  ? null
  : new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
      dangerouslyAllowBrowser: true,
    });

// ── Proxy helpers (production only) ──────────────────────────────────────────

async function proxyChat(body: object): Promise<Anthropic.Message> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Proxy error ${res.status}`);
  }
  return res.json();
}

async function proxyTitle(firstUserMessage: string, firstAIResponse: string): Promise<string> {
  const res = await fetch("/api/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstUserMessage, firstAIResponse }),
  });
  if (!res.ok) return firstUserMessage.slice(0, 40);
  const data = await res.json();
  return data.title ?? firstUserMessage.slice(0, 40);
}

// ── System prompts ────────────────────────────────────────────────────────────

const SEMI_FINALIST_RUBRIC = `
SEMI-FINAL BOARDROOM PITCH RUBRIC (score each 1–5):

5 - WOW FACTOR | 4 - SHOWS MERIT | 3 - AVERAGE, NOT REMARKABLE | 2 - BELOW AVERAGE | 1 - SIGNIFICANTLY LACKING

1. PROBLEM (Clear & Believable)
   5: Pain fully described with compelling urgency and primary data. Significant, urgent, high cost of inaction.
   4: Clearly described with good secondary research. Real and important, moderately demonstrates market need.
   3: Described but average. Present but lacks urgency OR relies on generic assumptions.
   2: Incomplete/unclear with minimal details. Weak or questionable, barely demonstrates why customers would pay.
   1: Not adequately addressed. Missing or unconvincing, little to no market need demonstrated.

2. SOLUTION (Clear & Compelling)
   5: Value prop fully articulated with 10x improvement over alternatives. BOTH solution AND measurable benefits (ROI, time saved) are EXCEPTIONAL.
   4: Clearly described with logical connection to pain. BOTH solution AND benefits are CLEAR.
   3: Described but average. EITHER solution OR benefits lack clarity.
   2: Incomplete/unclear with weak connection to pain. EITHER solution OR benefits are VAGUE.
   1: Not adequately addressed. Solution AND benefits are MISSING or UNCONVINCING.

3. TARGET MARKET (Clear & Realistic)
   5: Customer and market segment fully defined. BOTH customer profile AND market sizing (TAM/SAM/SOM) are EXCEPTIONAL.
   4: Clearly described with good details. BOTH customer profile AND market linkage are CLEAR.
   3: Described but average. EITHER customer profile OR market linkage lacks specificity (e.g., "all small businesses").
   2: Incomplete/vague. EITHER customer profile OR market linkage is WEAK.
   1: Not adequately addressed. Fundamental misunderstanding of the market.

4. COMPETITION (Clear & Realistic)
   5: Competitive advantage fully described with defensible moat (IP, Network Effects, High Switching Costs). BOTH deep analysis AND unique position are EXCEPTIONAL.
   4: Clearly described with good differentiation. BOTH analysis AND position are CLEAR.
   3: Average. EITHER analysis OR position lacks clarity, or advantage is easily replicable.
   2: Incomplete/unclear. Claims of being "the only one" signal lack of research.
   1: Not adequately addressed. Analysis AND position are MISSING or UNCONVINCING.

5. BUSINESS MODEL (Clear & Realistic)
   5: Fully defined with multiple revenue streams, unit economics (LTV/CAC), AND alignment with customer behavior — all EXCEPTIONAL.
   4: Clearly described. BOTH revenue model AND customer alignment are CLEAR with realistic path to profitability.
   3: Average. EITHER revenue model OR customer alignment lacks detail (e.g., "we will sell ads" without traffic plan).
   2: Incomplete/vague. EITHER revenue model OR customer alignment is WEAK.
   1: Not adequately addressed. Financial logic is flawed or missing.

6. GO-TO-MARKET PLAN (Clear & Realistic)
   5: Fully defined with clear path to first customers. BOTH acquisition channels AND tactical timeline are EXCEPTIONAL.
   4: Clearly described. BOTH channels AND path to market are CLEAR.
   3: Average. EITHER channels OR timeline lacks detail, or relies on generic "social media" assumptions.
   2: Incomplete/vague. EITHER channels OR timeline is WEAK.
   1: Not adequately addressed. "How" of customer acquisition is missing.

7. FINANCIALS (Clear & Viable)
   5: 3–5 year projections fully articulated. BOTH unit economics (LTV/CAC) AND key assumptions are EXCEPTIONAL.
   4: Clearly described. BOTH projections AND key assumptions are CLEAR and realistic.
   3: Average. EITHER projections OR assumptions lack depth, or numbers seem overly optimistic.
   2: Incomplete/vague. EITHER projections OR assumptions are WEAK.
   1: Not adequately addressed. Numbers missing or show lack of basic financial literacy.

8. TEAM (Complete & Capable)
   5: Team composition fully described and ideally suited. BOTH relevant experience AND Founder-Market Fit are EXCEPTIONAL.
   4: Clearly described. BOTH skills AND experience are CLEAR and relevant.
   3: Average. EITHER skills OR experience lack depth, or significant gaps in critical roles.
   2: Incomplete/vague. EITHER skills OR experience are WEAK.
   1: Not adequately addressed. Bios missing or irrelevant to the business.

9. PRESENTATION (Quality & Integrity)
   5: Layout and visuals professional. BOTH design quality AND narrative flow are EXCEPTIONAL.
   4: Clear and professional. BOTH design AND clarity are GOOD.
   3: Average. EITHER design OR flow lacks cohesion, or pitch feels generic/unpolished.
   2: Minimal or poorly executed. EITHER design OR narrative is WEAK.
   1: Not adequately addressed. Disorganized or poor delivery damages credibility.

10. Q&A RESPONSES (Poise & Substance) — Score based on how well the pitch anticipates and addresses likely judge questions.
   5: Responses would demonstrate exceptional domain expertise. BOTH depth AND poise under pressure are EXCEPTIONAL.
   4: Responses would be clear and well-informed. BOTH substance AND composure are CLEAR and confident.
   3: Responses would be average. EITHER depth OR poise is lacking; answers may be superficial.
   2: Responses would be incomplete/vague. EITHER substance OR poise is WEAK.
   1: Pitch does not prepare the founder to answer likely questions. Evasive or factually incorrect responses expected.
`;

const buildSystemPrompt = (pitchLength: PitchLength, isPitchMode: boolean): string => {
  const isSemiFinalist = pitchLength === "10min";

  const lengthContext = isSemiFinalist
    ? `The user is practicing a ~10-minute SEMI-FINALIST BOARDROOM PITCH for the Stella Zhang NVC. This is the highest stakes round. Score using the official Semi-Final Boardroom Rubric (1–5 scale). Expect full coverage of ALL rubric areas. Be demanding — judges at this level expect depth, data, and polish.`
    : pitchLength === "3min"
    ? `The user is practicing a ~3-minute GRAND FINAL PITCH. Score using the general rubric (1–10 scale). Expect coverage of the key areas: Problem, Solution, Market, Business Model, and a compelling ask. Help them balance depth vs. speed.`
    : `The user is practicing a ~60-second ELEVATOR PITCH. Score using the general rubric (1–10 scale). Focus on: Problem, Solution, Target Market, and Business Model. Judges do NOT expect full financials at this stage.`;

  const rubricSection = isSemiFinalist ? SEMI_FINALIST_RUBRIC : `
GENERAL PITCH RUBRIC (score each 1–10):
- Structure (1–10): Is the pitch logically organized with a clear flow?
- Clarity (1–10): Is the core idea easy to understand immediately?
- Problem/Solution Fit (1–10): Is the solution clearly tied to a real, urgent pain?
- Market (1–10): Is the target market specific and sizeable?
- Traction (1–10): Is there evidence of momentum, validation, or early users?
- Delivery (1–10): Is the pitch confident, concise, and persuasive?
`;

  const scoresSchema = isSemiFinalist
    ? `"scores": {
      "scale": 5,
      "problem": <1-5>,
      "solution": <1-5>,
      "targetMarket": <1-5>,
      "competition": <1-5>,
      "businessModel": <1-5>,
      "gtm": <1-5>,
      "financials": <1-5>,
      "team": <1-5>,
      "presentation": <1-5>,
      "qa": <1-5>
    }`
    : `"scores": {
      "scale": 10,
      "structure": <1-10>,
      "clarity": <1-10>,
      "problemSolutionFit": <1-10>,
      "market": <1-10>,
      "traction": <1-10>,
      "delivery": <1-10>
    }`;

  const judgeQuestionsSchema = isSemiFinalist
    ? `"judgeQuestions": ["Tough judge question 1?", "Tough judge question 2?", "Tough judge question 3?"],`
    : ``;

  return `You are an AI Pitch Coach — tough but fair, like a seasoned startup judge who genuinely wants founders to succeed. You help founders improve their pitches for the Stella Zhang New Venture Competition at UC Irvine.

CRITICAL RULES:
1. NEVER refuse to answer a question. Answer every question fully and helpfully, every time, no exceptions.
2. NEVER redirect the user to pitch when they ask a question. Questions are valid — answer them.
3. If the user asks the same question multiple times, answer it again without commenting on the repetition.
4. If the user asks you to brainstorm, suggest ideas, or help them think through something (like target customers, differentiation, or business model options), DO IT. That is coaching. Never say "that's your job" or refuse to help think through ideas.
5. Be warm, encouraging, and collaborative — never preachy, condescending, or gatekeeping. You are a helpful coach, not a gatekeeper.

${lengthContext}

${rubricSection}

---

${isPitchMode ? `YOUR JOB: Read the user's message and decide if it is a PITCH or a FOLLOW-UP.

A PITCH is any message where the user is presenting or describing their startup idea — even a single sentence like "We make an app for dog owners" counts. Score ALL categories. If a category is not mentioned in the pitch, score it 1 and explain what is missing.

A FOLLOW-UP is anything else: a question, a request for clarification, a casual message, asking for rewrites, asking for examples, etc.` : `YOUR JOB: You are in CHAT MODE. Always respond conversationally — NEVER return a scorecard or feedback JSON, regardless of what the user says. Even if the user describes a startup idea, respond with a helpful conversational message. Always use the { "type": "chat", "message": "..." } format.`}

---

You MUST always respond with valid JSON only — no markdown, no code fences, no extra text.

If it's a PITCH, respond with:
{
  "type": "feedback",
  "feedback": {
    "summary": "Start with 'Got it — here's my honest take:' then briefly restate their concept in 1-2 sentences.",
    ${scoresSchema},
    "bigFixes": [
      { "what": "...", "why": "...", "example": "..." },
      { "what": "...", "why": "...", "example": "..." },
      { "what": "...", "why": "...", "example": "..." }
    ],
    "lineSuggestions": [
      { "before": "...", "after": "..." }
    ],
    "judgeNotes": ["As a judge, I might think...", "..."],
    ${judgeQuestionsSchema}
    "practicePrompt": "One short actionable practice instruction."
  }
}

If it's a FOLLOW-UP, respond with:
{
  "type": "chat",
  "message": "Your conversational coaching response here."
}

For FOLLOW-UP messages:
- You may answer any question related to pitching, startups, entrepreneurship, fundraising, business models, go-to-market strategy, investor relations, or general business topics. You are knowledgeable across the full startup ecosystem — not just pitch delivery. Always answer from the perspective of a seasoned startup coach who wants founders to succeed.
- Format your response using markdown. For structured answers, use numbered lists where each item has a **bold title** on its own line followed by a short explanation as a separate paragraph beneath it — like ChatGPT does. Use bullet points for simpler lists. Use **bold** for key terms inline. Never cram list items into a single run-on sentence. IMPORTANT: The message value must be valid JSON — escape all newlines as \n and all quotes as \". Do not include literal unescaped newlines inside the JSON string.
- Scale response length to the complexity of the question. Simple questions get 2-4 sentences. Only give long structured answers if the topic clearly warrants it or the user explicitly asks for detail.
- End your response with a short offer to go deeper or explore a related angle (1 sentence, naturally phrased).`;
};

// ── Parsing ───────────────────────────────────────────────────────────────────

const parseResponse = (raw: string): AIResponse => {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // First try a direct parse
  try {
    return JSON.parse(cleaned) as AIResponse;
  } catch {
    // If it fails, the AI likely included unescaped newlines or markdown inside the JSON string.
    // Try to salvage the "type" and "message" fields with a regex extraction.
    const typeMatch = cleaned.match(/"type"\s*:\s*"(\w+)"/);
    const messageMatch = cleaned.match(/"message"\s*:\s*"([\s\S]*?)"\s*[,}]/);

    if (typeMatch?.[1] === "chat" && messageMatch?.[1]) {
      return { type: "chat", message: messageMatch[1].replace(/\\n/g, "\n") };
    }

    // Last resort: treat the whole cleaned string as a plain chat message
    return { type: "chat", message: cleaned };
  }
};

// ── Main export ───────────────────────────────────────────────────────────────

export const getAIResponse = async (
  userMessage: string,
  history: ConversationTurn[],
  pitchLength: PitchLength,
  file?: ProcessedFile,
  videoContext?: { snapshot: string; stats: string },
  isPitchMode?: boolean
): Promise<AIResponse> => {
  // Build the final user content — text only, text + file, or text + video snapshot
  let userContent: Anthropic.MessageParam["content"];

  if (videoContext?.snapshot) {
    // Video pitch: include snapshot image + body language stats + transcript
    const textPart = [
      userMessage || "Please analyze this video pitch.",
      "",
      videoContext.stats,
    ].join("\n");

    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: videoContext.snapshot },
      },
      { type: "text", text: textPart },
    ];
  } else if (file) {
    if (file.contentType === "base64-pdf") {
      userContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: file.content },
          title: file.name,
        } as Anthropic.Base64PDFSource & { type: "document"; title: string },
        { type: "text", text: userMessage || "Please analyze this pitch document." },
      ];
    } else {
      // Plain text (TXT or DOCX extracted)
      userContent = `${userMessage ? userMessage + "\n\n" : ""}[Uploaded file: ${file.name}]\n\n${file.content}`;
    }
  } else {
    userContent = userMessage;
  }

  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    })),
    { role: "user", content: userContent },
  ];

  const requestBody = {
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: buildSystemPrompt(pitchLength, isPitchMode ?? false),
    messages,
  };

  const response = IS_PROD
    ? await proxyChat(requestBody)
    : await devClient!.messages.create(requestBody);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return parseResponse(textBlock.text);
};

// ── Auto-title generation ─────────────────────────────────────────────────────

export const generateSessionTitle = async (
  firstUserMessage: string,
  firstAIResponse: string
): Promise<string> => {
  if (IS_PROD) return proxyTitle(firstUserMessage, firstAIResponse);

  const response = await devClient!.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 16,
    system: "Generate a concise 3-5 word title for this conversation. Return only the title, no quotes, no punctuation at the end.",
    messages: [{
      role: "user",
      content: `User: "${firstUserMessage.slice(0, 300)}"\nAI: "${firstAIResponse.slice(0, 200)}"`,
    }],
  });
  const block = response.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : firstUserMessage.slice(0, 40);
};
