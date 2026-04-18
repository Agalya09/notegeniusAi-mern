const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const summaryRoutes = require("./routes/Summary");

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------- MIDDLEWARE --------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// -------------------- DB --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err.message));

// -------------------- UPLOADS --------------------
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// -------------------- ROUTES --------------------
app.use("/api/auth", authRoutes);
app.use("/api/summary", summaryRoutes);

// -------------------- IN-MEMORY DOC CONTEXT --------------------
const latestDocumentByContext = new Map();
const chatHistoryByContext = new Map();

// -------------------- NLP HELPERS --------------------
const stopWords = new Set([
  "the", "is", "are", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "by", "as", "at", "from", "that", "this", "it", "be", "was", "were", "has", "have",
  "had", "will", "can", "into", "about", "their", "them", "also", "than", "then",
  "but", "not", "which", "who", "what", "when", "where", "why", "how", "you", "your",
  "we", "our", "they", "he", "she", "his", "her", "its", "i", "am", "been", "being",
]);

function getContextKey(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) {
        return `user:${decoded.id}`;
      }
    } catch {
      // fallback to guest key
    }
  }

  return "guest";
}

function setDocumentText(req, text) {
  const key = getContextKey(req);
  latestDocumentByContext.set(key, text);
  chatHistoryByContext.set(key, []);
}

function getDocumentText(req) {
  return latestDocumentByContext.get(getContextKey(req)) || "";
}

function getHistory(req) {
  return chatHistoryByContext.get(getContextKey(req)) || [];
}

function pushHistory(req, question, answer) {
  const key = getContextKey(req);
  const history = chatHistoryByContext.get(key) || [];
  history.push({ question, answer });
  chatHistoryByContext.set(key, history.slice(-6));
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word) && word.length > 2);
}

function splitIntoChunks(text, maxChunkLength = 900) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return [];
  }

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > maxChunkLength) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function getTopRelevantChunks(question, text, topK = 4) {
  const questionTokens = tokenize(question);
  const questionTokenSet = new Set(questionTokens);
  const questionLower = (question || "").toLowerCase();
  const chunks = splitIntoChunks(text, 900);

  if (chunks.length === 0) {
    return [];
  }

  const scored = chunks
    .map((chunk, idx) => {
      const tokens = tokenize(chunk);
      const uniqueTokens = new Set(tokens);

      let exactOverlap = 0;
      let partialOverlap = 0;
      for (const token of uniqueTokens) {
        if (questionTokenSet.has(token)) {
          exactOverlap += 1;
          continue;
        }

        for (const qToken of questionTokenSet) {
          if (
            qToken.length >= 4 &&
            (token.includes(qToken) || qToken.includes(token))
          ) {
            partialOverlap += 1;
            break;
          }
        }
      }

      const phraseBoost = questionLower && chunk.toLowerCase().includes(questionLower) ? 2 : 0;
      const density = tokens.length ? (exactOverlap + partialOverlap) / tokens.length : 0;
      const score = exactOverlap * 3 + partialOverlap + phraseBoost + density;
      return {
        id: idx + 1,
        chunk,
        score,
        overlap: exactOverlap + partialOverlap,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score > 0 || questionTokens.length === 0);

  return scored;
}

function isGreeting(question) {
  return /^(hi|hello|hey|good\s(morning|afternoon|evening))\b/i.test(question.trim());
}

function buildPrompt(question, selectedChunks, history) {
  const context = selectedChunks
    .map((item, idx) => `[Chunk ${idx + 1}] ${item.chunk}`)
    .join("\n\n");

  const historyText = history
    .slice(-3)
    .map((item, idx) => `Turn ${idx + 1} Q: ${item.question}\nTurn ${idx + 1} A: ${item.answer}`)
    .join("\n\n");

  return `You are a precise document assistant.
Rules:
- Answer ONLY from the provided context chunks.
- If the answer is not present, say exactly: "The answer is not available in the document."
- Keep the answer concise and factual.
- Do not invent facts.

Conversation history:
${historyText || "(none)"}

Context chunks:
${context}

Question:
${question}

Answer:`;
}

function buildFallbackAnswer(selectedChunks) {
  if (!selectedChunks.length) {
    return "The answer is not available in the document.";
  }

  const topSentences = selectedChunks
    .map((item) => splitSentences(item.chunk)[0])
    .filter(Boolean)
    .slice(0, 2);

  if (!topSentences.length) {
    return "The answer is not available in the document.";
  }

  return topSentences.join(" ");
}

function buildExtractiveAnswer(question, selectedChunks) {
  const questionTokens = tokenize(question);
  const tokenSet = new Set(questionTokens);

  const candidateSentences = selectedChunks
    .flatMap((item) => splitSentences(item.chunk))
    .filter(Boolean)
    .map((sentence, idx) => {
      const tokens = tokenize(sentence);
      let score = 0;

      for (const token of tokens) {
        if (tokenSet.has(token)) {
          score += 2;
        } else {
          for (const qToken of tokenSet) {
            if (qToken.length >= 4 && (token.includes(qToken) || qToken.includes(token))) {
              score += 1;
              break;
            }
          }
        }
      }

      return { sentence, score, idx };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.sentence);

  if (!candidateSentences.length || candidateSentences.every((s) => !s.trim())) {
    return buildFallbackAnswer(selectedChunks);
  }

  return candidateSentences.join(" ");
}

async function answerDocumentQuestion(question, documentText, history) {
  const selectedChunks = getTopRelevantChunks(question, documentText, 4);
  const topScore = selectedChunks[0]?.score || 0;
  const confidence = topScore >= 4 ? "high" : topScore >= 2 ? "medium" : "low";

  if (!selectedChunks.length || topScore < 1) {
    return {
      answer: "The answer is not available in the document.",
      sources: [],
      confidence: "low",
    };
  }

  const prompt = buildPrompt(question, selectedChunks, history);

  try {
    const response = await axios.post(
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-large",
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 180,
          temperature: 0.2,
          do_sample: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const modelAnswer = (
      response.data?.generated_text ||
      response.data?.[0]?.generated_text ||
      ""
    ).trim();

    const extractiveAnswer = buildExtractiveAnswer(question, selectedChunks);
    const answer =
      modelAnswer && modelAnswer !== "The answer is not available in the document."
        ? modelAnswer
        : extractiveAnswer;

    return {
      answer: answer || extractiveAnswer || buildFallbackAnswer(selectedChunks),
      sources: selectedChunks.map((item, idx) => ({
        id: idx + 1,
        excerpt: item.chunk.slice(0, 220),
      })),
      confidence,
    };
  } catch (hfErr) {
    console.log("HF CHAT ERROR:", hfErr.response?.data || hfErr.message);
    const extractiveAnswer = buildExtractiveAnswer(question, selectedChunks);
    return {
      answer: extractiveAnswer || buildFallbackAnswer(selectedChunks),
      sources: selectedChunks.map((item, idx) => ({
        id: idx + 1,
        excerpt: item.chunk.slice(0, 220),
      })),
      confidence,
    };
  }
}

function splitSentences(text) {
  return (text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function getWordFrequency(text) {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stopWords.has(w) && w.length > 2);

  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }
  return freq;
}

function scoreSentences(sentences, freq) {
  return sentences.map((sentence, index) => {
    const words = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/);

    let score = 0;
    for (const word of words) {
      if (freq[word]) {
        score += freq[word];
      }
    }

    return { sentence, score, index };
  });
}

function generateSummaryAndPoints(text, length = "medium") {
  const cleanText = (text || "").trim();
  const sentences = splitSentences(cleanText);

  if (sentences.length === 0) {
    return {
      summary: "No meaningful text found.",
      points: [],
    };
  }

  const freq = getWordFrequency(cleanText);
  const scored = scoreSentences(sentences, freq);

  let summaryCount = 3;
  let pointCount = 5;

  if (length === "short") {
    summaryCount = 2;
    pointCount = 3;
  } else if (length === "long") {
    summaryCount = 5;
    pointCount = 7;
  }

  const summarySentences = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(summaryCount, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const keyPoints = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(pointCount, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence.replace(/[.?!]+$/, "").trim());

  return {
    summary: summarySentences.length
      ? summarySentences.join(" ")
      : sentences.slice(0, 2).join(" "),
    points: [...new Set(keyPoints)],
  };
}


     // -------------------- SUMMARY --------------------
app.post("/summarize", async (req, res) => {
  console.log("NEW SUMMARIZE ROUTE HIT");

  try {
    const text = (req.body.text || "").trim();
    const length = req.body.length || "medium";

    if (!text || text.length < 20) {
      return res.status(400).json({
        summary: "Text too short",
        points: [],
      });
    }

    // Keep the latest summarized text as chat context for the same requester.
    setDocumentText(req, text);

    let maxLen = 120;
    let minLen = 40;

    if (length === "short") {
      maxLen = 60;
      minLen = 20;
    } else if (length === "long") {
      maxLen = 200;
      minLen = 80;
    }

    try {
      const response = await axios.post(
        "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
        {
          inputs: text,
          parameters: {
            max_length: maxLen,
            min_length: minLen,
            do_sample: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      console.log("HF RESPONSE:", response.data);

      const summary =
        Array.isArray(response.data)
          ? response.data[0]?.summary_text
          : response.data?.summary_text;

      if (summary && summary.trim()) {
        return res.json({
          summary,
          points: generateSummaryAndPoints(text, length).points,
        });
      }
    } catch (hfErr) {
      console.log("HF ERROR:", hfErr.response?.data || hfErr.message);
    }

    // fallback summary if HF fails
    const fallback = generateSummaryAndPoints(text, length);
    return res.json(fallback);

  } catch (err) {
    console.log("FINAL SUMMARY ERROR:", err.message);

    const fallback = generateSummaryAndPoints(
      req.body.text || "",
      req.body.length || "medium"
    );
    return res.json(fallback);
  }
});
// -------------------- HUGGING FACE DOC CHAT --------------------
async function handleAskDocument(req, res) {
  console.log("CHAT HIT");
  try {
    const question = (req.body.question || "").trim();
    const latestDocumentText = getDocumentText(req);
    const history = getHistory(req);

    console.log("CHAT BODY:", req.body);
    console.log("HAS HF KEY:", !!process.env.HF_API_KEY);
    console.log("HAS DOC TEXT:", !!latestDocumentText);

    if (!question) {
      return res.status(400).json({
        answer: "",
        message: "No question provided",
      });
    }

    if (isGreeting(question) && !latestDocumentText) {
      return res.json({
        answer: "Hello! Upload a PDF first, then ask me anything from that document.",
        sources: [],
        confidence: "high",
      });
    }

    if (!latestDocumentText) {
      return res.status(400).json({
        answer: "",
        message: "No document available. First summarize text or upload a PDF.",
      });
    }
    const result = await answerDocumentQuestion(question, latestDocumentText, history);
    pushHistory(req, question, result.answer);
    return res.json(result);
  } catch (err) {
    console.log("ASK ERROR:", err.message);
    return res.status(500).json({
      answer: "",
      message: "Chatbot failed",
    });
  }
}

app.post("/ask-openai", handleAskDocument);

// -------------------- GRAMMAR CHECK --------------------
app.post("/grammar-check", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        correctedText: "",
        suggestions: ["No text provided"],
      });
    }

    const response = await axios.post(
      "https://api.languagetool.org/v2/check",
      new URLSearchParams({
        text: text,
        language: "en-US",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const matches = response.data.matches;

    // suggestions collect pannrom
    const suggestions = matches.map((m) => m.message);

    // simple correction (optional)
    let correctedText = text;

    matches.forEach((match) => {
      if (match.replacements.length > 0) {
        correctedText = correctedText.replace(
          text.substr(match.offset, match.length),
          match.replacements[0].value
        );
      }
    });

    res.json({
      correctedText,
      suggestions,
    });

  } catch (err) {
    console.log("LanguageTool ERROR:", err.message);

    res.status(500).json({
      correctedText: "",
      suggestions: ["Grammar API failed"],
    });
  }
});

// -------------------- TRANSLATE --------------------
app.post("/translate", async (req, res) => {
  console.log("TRANSLATE HIT");
  try {
    const text = (req.body.text || "").trim();
    const target = (req.body.target || req.body.lang || "ta").trim();

    console.log("TRANSLATE BODY:", req.body);

    if (!text) {
      return res.status(400).json({
        translatedText: "",
        output: "",
        message: "No text provided",
      });
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=en|${encodeURIComponent(target)}`;

    const response = await axios.get(url);
    const data = response.data;

    const translatedText =
      data &&
      data.responseData &&
      data.responseData.translatedText
        ? data.responseData.translatedText
        : "Translation unavailable";

    return res.json({
      translatedText,
      output: translatedText,
    });
  } catch (err) {
    console.log("TRANSLATE ERROR:", err.message);
    return res.status(500).json({
      translatedText: "",
      output: "",
      message: "Translation failed",
    });
  }
});

// -------------------- PDF UPLOAD --------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("UPLOAD HIT");
  try {
    if (!req.file) {
      return res.status(400).json({
        summary: "No file uploaded",
        points: [],
      });
    }

    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfErr) {
      console.log("PDF PARSE ERROR:", pdfErr.message || pdfErr);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(500).json({
        summary: "Unable to read this PDF.",
        points: [],
      });
    }

    const text = (pdfData.text || "").trim();

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (!text) {
      return res.status(400).json({
        summary: "No readable text found in PDF.",
        points: [],
      });
    }

    setDocumentText(req, text);

    const result = generateSummaryAndPoints(text, "medium");

    return res.json({
      summary: result.summary,
      points: result.points,
    });
  } catch (err) {
    console.log("UPLOAD ERROR:", err.message);
    return res.status(500).json({
      summary: "PDF processing failed",
      points: [],
    });
  }
});

// -------------------- BASIC DOC QA FALLBACK --------------------
app.post("/ask-doc", handleAskDocument);

// -------------------- TEST --------------------
app.get("/test", (req, res) => {
  res.send("Backend working");
});

app.get("/", (req, res) => {
  res.send("NoteGenius backend is live");
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
