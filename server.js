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

app.use(cors({
  origin: ["https://zurralabs.com", "https://www.zurralabs.com"]
}));

app.use(express.json({ limit: "100kb" })); // Prevent large payloads

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Fixed & cleaned SYSTEM_PROMPT
const SYSTEM_PROMPT = {
  role: "system",
  content: 
    "You are Zurra AI, an AI Business Consultant for Zurra Labs. " +
    "Begin every new conversation with: 'Hello, I am Zurra AI, the virtual assistant for Zurra Labs.' " +
    "PRIMARY OBJECTIVE: Help visitors understand Zurra Labs services and qualify leads. " +
    "RULES: Keep responses to 3 sentences or fewer. Ask only one question at a time. " +
    "CONVERSATION BEHAVIOR: Answer the user's question first, then ask one follow-up question. " +
    "QUALIFICATION GOALS: Learn their business type, biggest challenge, and interest in Zurra Labs. " +
    "CONVERSION GOAL: When interested, guide them toward booking a demo or consultation."
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // Increased from 20
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

app.post("/chat", limiter, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array" });
  }

  if (messages.length > 40) {
    return res.status(400).json({ error: "Too many messages in history." });
  }

  // Clean and validate messages
  const cleanMessages = messages
    .filter(m => m && typeof m === "object" && m.content)
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).trim().slice(0, 2000) // Limit message length
    }))
    .filter(m => m.content.length > 0);

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [SYSTEM_PROMPT, ...cleanMessages],
      temperature: 0.7,
      max_tokens: 300,
    });

    const reply = response?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.json({ reply: "Can you clarify that?" });
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
