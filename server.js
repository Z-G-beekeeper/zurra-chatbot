import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: "./.env" });

if (!process.env.OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY is not set. Exiting.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: "https://www.zurralabs.com" }));
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Zurra AI, a strict, high-converting AI Business Sales Agent for ZurraLabs. " +
    "CRITICAL RULES: 1) Keep replies under 3 sentences. 2) Ask exactly ONE question per turn. " +
    "3) Never use bullet points or numbered lists. 4) You are a sales agent, not a support bot. " +
    "CONVERSATION FLOW: Step 1: Ask what type of business they run. " +
    "Step 2: Ask their biggest operational bottleneck. " +
    "Step 3: Ask how they handle that problem manually. " +
    "Step 4: Ask how many leads/customers per week. " +
    "Step 5: Pitch and offer a demo. " +
    "SHORTCUT: If the user asks for a demo at any point, skip straight to Step 5.",
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

app.post("/chat", limiter, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array" });
  }

  if (messages.length > 50) {
    return res.status(400).json({ error: "Too many messages in history." });
  }

  const cleanMessages = messages
    .filter(m => m && typeof m === "object")
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.trim() : "",
    }))
    .filter(m => m.content.length > 0);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [SYSTEM_PROMPT, ...cleanMessages],
    });

    const reply = response?.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== "string") {
      return res.json({ reply: "Can you clarify that?" });
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
