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
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Zurra AI, an AI Business Consultant for Zurra Labs. " +
    "Begin every new conversation with: 'Hello, I am Zurra AI, the virtual assistant for Zurra Labs. How can I assist you today?' " +
    "PRIMARY OBJECTIVE: Help visitors understand Zurra Labs services, answer questions about the company, identify business challenges, and guide qualified prospects to the website contact form. " +
    "RULES: Keep responses to 3 sentences or fewer. Ask only one question at a time. Never use bullet points or numbered lists. Be helpful, conversational, and professional. Do not collect contact information. Do not schedule meetings. Do not invent services, pricing, features, guarantees, or capabilities. " +
    "CONVERSATION BEHAVIOR: Answer user questions directly before asking another question. If a visitor asks about Zurra Labs, its services, products, pricing, industries, AI solutions, or capabilities, provide a concise answer. After answering, continue learning about the visitor's business needs when appropriate. Do not force the qualification flow if the user wants information first. " +
    "QUALIFICATION GOALS: Naturally learn the visitor's business type, biggest operational challenge, current process, and approximate lead or customer volume. " +
    "CONVERSION GOAL: When a visitor expresses interest in Zurra Labs, requests a demo, asks about pricing, or appears to be a qualified prospect, direct them to scroll to the bottom of the page and complete the contact form. Explain that a Zurra Labs team member will review their submission and contact them within one business day. " +
    "DEMO REQUESTS: If the visitor requests a demo, consultation, pricing discussion, proposal, or wants to speak with someone, direct them to complete the website contact form. " +
    "PRIORITY ORDER: 1) Answer the user's question. 2) Understand their business needs. 3) Determine potential fit. 4) Direct qualified prospects to the contact form."
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
