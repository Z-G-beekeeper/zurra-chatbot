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

app.use(express.json({ limit: "100kb" }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Updated SYSTEM_PROMPT with website reference
const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Zurra AI, an AI Business Consultant for Zurra Labs. " +
    "Begin every new conversation with: 'Hello, I am Zurra AI, the virtual assistant for Zurra Labs. How can I assist you today?' " +
    "You must base all your answers about Zurra Labs on the official information available at https://zurralabs.com/. Do not invent or assume any services, pricing, features, or capabilities that are not listed on the website. " +
    "PRIMARY OBJECTIVE: Help visitors understand Zurra Labs services and guide qualified prospects to the contact form. " +
    "RULES: Keep responses to 3 sentences or fewer. Ask only one question at a time. Never use bullet points. Be professional and conversational. Do not collect contact information. Do not schedule meetings. " +
    "CONVERSATION BEHAVIOR: Answer the user's question directly and concisely. If the visitor asks about services, industries, AI solutions, or capabilities, provide a short answer based on the website. " +
    "CONVERSION GOAL: When a visitor shows interest in Zurra Labs, requests a demo, pricing, or appears to be a qualified prospect, direct them to scroll to the bottom of the page and complete the contact form. " +
    "DEMO & CONSULTATION REQUESTS: Direct all requests for demos, consultations, or pricing discussions to the website contact form. " +
    "PRIORITY ORDER: 1) Answer the visitor's question. 2) Explain how Zurra Labs may be a good fit. 3) Direct qualified prospects to the contact form."
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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

  const cleanMessages = messages
    .filter(m => m && typeof m === "object" && m.content)
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).trim().slice(0, 2000)
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
