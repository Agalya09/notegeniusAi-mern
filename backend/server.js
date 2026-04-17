const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const summaryRoutes = require("./routes/Summary");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB error:", err.message));

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

app.use("/api/auth", authRoutes);
app.use("/api/summary", summaryRoutes);

let latestDocumentText = "";

const stopWords = new Set([
  "the", "is", "are", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "by", "as", "at", "from", "that", "this", "it", "be", "was", "were", "has", "have",
  "had", "will", "can", "into", "about", "their", "them", "also", "than", "then",
  "but", "not", "which", "who", "what", "when", "where", "why", "how", "you", "your",
  "we", "our", "they", "he", "she", "his", "her", "its", "i", "am", "been", "being"
]);

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
      points: []
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
    points: [...new Set(keyPoints)]
  };
}

app.post("/summarize", (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    const length = req.body.length || "medium";

    if (!text) {
      return res.status(400).json({
        summary: "No text provided",
        points: []
      });
    }

    latestDocumentText = text;
    const result = generateSummaryAndPoints(text, length);

    return res.json(result);
  } catch (err) {
    console.log("SUMMARIZE ERROR:", err);
    return res.status(500).json({
      summary: "Error generating summary",
      points: []
    });
  }
});

app.post("/grammar-check", (req, res) => {
  try {
    const text = (req.body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        correctedText: "",
        suggestions: ["No text provided"]
      });
    }

    let correctedText = text;
    const suggestions = [];

    if (correctedText.length > 0) {
      const firstChar = correctedText.charAt(0);
      if (firstChar === firstChar.toLowerCase()) {
        correctedText = firstChar.toUpperCase() + correctedText.slice(1);
        suggestions.push("First letter should be capitalized.");
      }
    }

    if (/\s{2,}/.test(correctedText)) {
      correctedText = correctedText.replace(/\s{2,}/g, " ");
      suggestions.push("Removed extra spaces.");
    }

    const replacements = [
      { wrong: /\bi\b/g, right: "I", message: 'Changed "i" to "I".' },
      { wrong: /\bim\b/gi, right: "I am", message: 'Changed "im" to "I am".' },
      { wrong: /\bdont\b/gi, right: "don't", message: 'Changed "dont" to "don\'t".' },
      { wrong: /\bcant\b/gi, right: "can't", message: 'Changed "cant" to "can\'t".' },
      { wrong: /\bwont\b/gi, right: "won't", message: 'Changed "wont" to "won\'t".' },
      { wrong: /\bdoesnt\b/gi, right: "doesn't", message: 'Changed "doesnt" to "doesn\'t".' },
      { wrong: /\bidk\b/gi, right: "I don't know", message: 'Expanded "idk".' }
    ];

    replacements.forEach((item) => {
      if (item.wrong.test(correctedText)) {
        correctedText = correctedText.replace(item.wrong, item.right);
        suggestions.push(item.message);
      }
    });

    if (correctedText.length > 0 && !/[.!?]$/.test(correctedText)) {
      correctedText += ".";
      suggestions.push("Added ending punctuation.");
    }

    if (suggestions.length === 0) {
      suggestions.push("No major grammar suggestions found.");
    }

    return res.json({
      correctedText,
      suggestions
    });
  } catch (err) {
    console.log("GRAMMAR ERROR:", err);
    return res.status(500).json({
      correctedText: "",
      suggestions: ["Grammar check failed"]
    });
  }
});

app.post("/translate", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    const target = (req.body.target || req.body.lang || "ta").trim();

    if (!text) {
      return res.status(400).json({
        translatedText: "",
        output: "",
        message: "No text provided"
      });
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(target)}`;

    const response = await fetch(url);
    const data = await response.json();

    const translatedText =
      data &&
      data.responseData &&
      data.responseData.translatedText
        ? data.responseData.translatedText
        : "Translation unavailable";

    return res.json({
      translatedText,
      output: translatedText
    });
  } catch (err) {
    console.log("TRANSLATE ERROR:", err);
    return res.status(500).json({
      translatedText: "",
      output: "",
      message: "Translation failed"
    });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("UPLOAD HIT");

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({
        summary: "No file uploaded",
        points: []
      });
    }

    console.log("File name:", req.file.originalname);
    console.log("File path:", req.file.path);

    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);

    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (pdfErr) {
      console.log("PDF PARSE ERROR:", pdfErr);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(500).json({
        summary: "Unable to read this PDF.",
        points: []
      });
    }

    const text = (pdfData.text || "").trim();
    console.log("Extracted text length:", text.length);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (!text) {
      return res.status(400).json({
        summary: "No readable text found in PDF.",
        points: []
      });
    }

    latestDocumentText = text;

    const result = generateSummaryAndPoints(text, "medium");

    return res.json({
      summary: result.summary,
      points: result.points
    });
  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    return res.status(500).json({
      summary: "PDF processing failed",
      points: []
    });
  }
});

app.post("/ask-doc", (req, res) => {
  try {
    const question = (req.body.question || "").trim();

    if (!question) {
      return res.status(400).json({
        answer: "",
        message: "No question provided"
      });
    }

    if (!latestDocumentText) {
      return res.status(400).json({
        answer: "",
        message: "No document available. First summarize text or upload a PDF."
      });
    }

    const questionWords = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && !stopWords.has(w));

    const sentences = splitSentences(latestDocumentText);

    let bestSentence = "";
    let bestScore = -1;

    for (const sentence of sentences) {
      const cleanSentence = sentence.toLowerCase();
      let score = 0;

      for (const word of questionWords) {
        if (cleanSentence.includes(word)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }

    return res.json({
      answer: bestSentence || "I could not find a clear answer in the current document."
    });
  } catch (err) {
    console.log("ASK DOC ERROR:", err);
    return res.status(500).json({
      answer: "",
      message: "Chatbot failed"
    });
  }
});

app.get("/test", (req, res) => {
  res.send("Backend working");
});

app.get("/", (req, res) => {
  res.send("NoteGenius backend is live");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
