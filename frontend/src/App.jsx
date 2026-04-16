import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const BASE_URL = "https://notegenius-ai-t75e.onrender.com";

const tabs = [
  { key: "summary", label: "Summary", icon: "📝" },
  { key: "grammar", label: "Grammar", icon: "✍️" },
  { key: "translate", label: "Translate", icon: "🌐" },
  { key: "pdf", label: "PDF", icon: "📄" },
  { key: "chatbot", label: "Chatbot", icon: "💬" },
  { key: "history", label: "History", icon: "🕘" },
];

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default function App() {
  const [activeTab, setActiveTab] = useState("summary");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const [text, setText] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");

  const [grammarText, setGrammarText] = useState("");

  const [translateText, setTranslateText] = useState("");
  const [translateTarget, setTranslateTarget] = useState("ta");

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState("");
  const [pdfQuestion, setPdfQuestion] = useState("");

  const [chatbotQuestion, setChatbotQuestion] = useState("");

  const [historyItems, setHistoryItems] = useState([]);

  const [outputTitle, setOutputTitle] = useState("Result");
  const [outputSubTitle, setOutputSubTitle] = useState("Processed output will appear here.");
  const [resultTag, setResultTag] = useState("Ready");
  const [outputHtml, setOutputHtml] = useState("");
  const [currentData, setCurrentData] = useState(null);

  const [loading, setLoading] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const bodyClass =
    theme === "dark"
      ? "min-h-screen bg-slate-950 text-white"
      : "min-h-screen bg-[#f6f3ec] text-slate-900";

  const sidebarClass =
    theme === "dark"
      ? "hidden lg:flex w-24 bg-black border-r border-slate-800 flex-col items-center py-6"
      : "hidden lg:flex w-24 bg-[#f2efe8] border-r border-slate-200 flex-col items-center py-6";

  const cardClass =
    theme === "dark"
      ? "rounded-[30px] border border-slate-700 bg-slate-900 shadow-sm"
      : "rounded-[30px] border border-slate-200 bg-white shadow-sm";

  const mutedTextClass = theme === "dark" ? "text-slate-400" : "text-slate-500";

  const outputTextClass = theme === "dark" ? "text-slate-100 leading-7" : "text-slate-800 leading-7";

  const navClass = (tab) =>
    `w-16 min-h-[86px] rounded-[18px] flex flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-semibold transition ${
      activeTab === tab
        ? theme === "dark"
          ? "bg-white text-slate-900"
          : "bg-slate-900 text-white"
        : theme === "dark"
        ? "text-slate-300 hover:bg-slate-800"
        : "text-slate-600 hover:bg-white"
    }`;

  function resetOutput() {
    setOutputTitle("Result");
    setOutputSubTitle("Processed output will appear here.");
    setResultTag("Ready");
    setOutputHtml("");
    setCurrentData(null);
  }

  function resetWorkspace() {
    setText("");
    setGrammarText("");
    setTranslateText("");
    setPdfFile(null);
    setPdfPreview("");
    setPdfQuestion("");
    setChatbotQuestion("");
    setHistoryItems([]);
    resetOutput();
    setActiveTab("summary");
  }

  function renderSummary(data, label = "Summary") {
    setOutputTitle(label === "PDF Summary" ? "PDF Summary Result" : "Summary Result");
    setOutputSubTitle("Generated summary and key points are shown below.");
    setResultTag(label);

    let html = `
      <div class="mb-6">
        <h4 class="text-lg font-semibold mb-2">Summary</h4>
        <p>${escapeHtml(data.summary || "No summary available")}</p>
      </div>
    `;

    if (data.points && data.points.length > 0) {
      html += `
        <div>
          <h4 class="text-lg font-semibold mb-2">Key Points</h4>
          <ul class="list-disc pl-5 space-y-2">
            ${data.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    setOutputHtml(html);
    setCurrentData({
      type: label.toLowerCase(),
      summary: data.summary || "",
      points: data.points || [],
    });
  }

  function renderGrammar(data) {
    setOutputTitle("Grammar Result");
    setOutputSubTitle("Corrected text and suggestions are shown below.");
    setResultTag("Grammar");

    const html = `
      <div class="mb-6">
        <h4 class="text-lg font-semibold mb-2">Corrected Text</h4>
        <p>${escapeHtml(data.correctedText || "")}</p>
      </div>
      <div>
        <h4 class="text-lg font-semibold mb-2">Suggestions</h4>
        ${
          data.suggestions?.length
            ? `<ul class="list-disc pl-5 space-y-2">
                ${data.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>`
            : "<p>No grammar suggestions found.</p>"
        }
      </div>
    `;

    setOutputHtml(html);
    setCurrentData({
      type: "grammar",
      summary: data.correctedText || "",
      points: data.suggestions || [],
    });
  }

  function renderTranslation(data, label) {
    const translated = data.translatedText || data.output || "Translation unavailable";

    setOutputTitle("Translation Result");
    setOutputSubTitle("Translated output is shown below.");
    setResultTag("Translate");
    setOutputHtml(`
      <div>
        <h4 class="text-lg font-semibold mb-2">${escapeHtml(label)} Translation</h4>
        <p>${escapeHtml(translated)}</p>
      </div>
    `);

    setCurrentData({
      type: "translate",
      summary: translated,
      points: [],
    });
  }

  async function summarizeText() {
    if (!text.trim()) {
      alert("Enter text first.");
      return;
    }

    setLoading(true);
    setResultTag("Processing");
    setOutputTitle("Summary Result");
    setOutputSubTitle("Generating summary from your input.");
    setOutputHtml("<p class='text-slate-500'>Generating summary...</p>");

    try {
      const res = await axios.post(`${BASE_URL}/summarize`, {
        text,
        length: summaryLength,
      });

      renderSummary(res.data, "Summary");
      setTranslateText(res.data.summary || "");
    } catch (err) {
  console.log("SUMMARIZE ERROR:", err);
  console.log("SUMMARIZE RESPONSE:", err.response);
  console.log("SUMMARIZE DATA:", err.response?.data);
  console.log("SUMMARIZE MESSAGE:", err.message);

  setOutputHtml("<p class='text-red-500'>Unable to generate summary.</p>");
  } finally {
      setLoading(false);
    }
  }

  async function checkGrammar() {
    if (!grammarText.trim()) {
      alert("Enter text first.");
      return;
    }

    setLoading(true);
    setResultTag("Processing");
    setOutputTitle("Grammar Result");
    setOutputSubTitle("Checking grammar suggestions.");
    setOutputHtml("<p class='text-slate-500'>Checking grammar...</p>");

    try {
      const res = await axios.post(`${BASE_URL}/grammar-check`, {
        text: grammarText,
      });

      renderGrammar(res.data);
    } catch (err) {
      setOutputHtml("<p class='text-red-500'>Unable to check grammar.</p>");
    } finally {
      setLoading(false);
    }
  }

async function translateTextContent() {
    if (!translateText.trim()) {
      alert("Enter text to translate.");
      return;
    }

    setLoading(true);
    setResultTag("Processing");
    setOutputTitle("Translation Result");
    setOutputSubTitle("Translating your text.");
    setOutputHtml("<p class='text-slate-500'>Translating text...</p>");

    try {
      const res = await axios.post(`${BASE_URL}/translate`, {
        text: translateText,
        target: translateTarget,
      });

      const label =
        translateTarget === "ta"
          ? "Tamil"
          : translateTarget === "hi"
          ? "Hindi"
          : translateTarget === "ml"
          ? "Malayalam"
          : translateTarget;

      renderTranslation(res.data, label);
    } catch (err) {
      setOutputHtml("<p class='text-red-500'>Translation failed.</p>");
    } finally {
      setLoading(false);
    }
  }

  async function translateCurrentSummary() {
    if (!currentData || !currentData.summary) {
      alert("No current summary available to translate.");
      return;
    }

    setTranslateText(currentData.summary);
    setActiveTab("translate");
  }

  async function uploadPDF() {
    if (!pdfFile) {
      alert("Choose a PDF file.");
      return;
    }

    setLoading(true);
    setResultTag("Processing");
    setOutputTitle("PDF Summary Result");
    setOutputSubTitle("Extracting text and generating summary from the uploaded PDF.");
    setOutputHtml("<p class='text-slate-500'>Processing PDF...</p>");

    try {
      const previewUrl = URL.createObjectURL(pdfFile);
      setPdfPreview(previewUrl);

      const formData = new FormData();
      formData.append("file", pdfFile);

      const res = await axios.post(`${BASE_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      renderSummary(res.data, "PDF Summary");
      setTranslateText(res.data.summary || "");
    } catch (err) {
      setOutputHtml("<p class='text-red-500'>PDF upload failed.</p>");
    } finally {
      setLoading(false);
    }
  }

  async function askDoc(questionText) {
    if (!questionText.trim()) {
      alert("Enter a question.");
      return;
    }

    setLoading(true);
    setResultTag("Processing");
    setOutputTitle("Document Answer");
    setOutputSubTitle("Checking your document for the best possible answer.");
    setOutputHtml("<p class='text-slate-500'>Finding answer...</p>");

    try {
      const res = await axios.post(`${BASE_URL}/ask-doc`, {
        question: questionText,
      });

      setOutputHtml(`
        <div>
          <h4 class="text-lg font-semibold mb-2">Answer</h4>
          <p>${escapeHtml(res.data.answer || res.data.message || "No answer available.")}</p>
        </div>
      `);

      setCurrentData({
        type: "chatbot",
        summary: res.data.answer || res.data.message || "",
        points: [],
      });
      setResultTag("Chatbot");
    } catch (err) {
      setOutputHtml("<p class='text-red-500'>Unable to answer right now.</p>");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    if (!user || (!user._id && !user.id)) {
      setHistoryItems([]);
      return;
    }

    try {
      const res = await axios.get(`${BASE_URL}/api/summary/${user._id || user.id}`);
      setHistoryItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setHistoryItems([]);
    }
  }

  async function saveSummary() {
    if (!currentData) {
      alert("No result available to save.");
      return;
    }

    if (!user || (!user._id && !user.id)) {
      alert("User not found. Please login again.");
      return;
    }

    let originalText = "";
    if (activeTab === "summary") originalText = text.trim();
    else if (activeTab === "grammar") originalText = grammarText.trim();
    else if (activeTab === "translate") originalText = translateText.trim();
    else if (activeTab === "pdf") originalText = "[PDF Uploaded Content]";
    else if (activeTab === "chatbot") originalText = chatbotQuestion.trim();

    try {
      await axios.post(`${BASE_URL}/api/summary/save`, {
        userId: user._id || user.id,
        text: originalText,
        summary: currentData.summary,
        points: currentData.points || [],
      });

      alert("Saved successfully!");
      if (activeTab === "history") {
        loadHistory();
      }
    } catch (err) {
      alert("Save failed.");
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await axios.delete(`${BASE_URL}/api/summary/${id}`);
      loadHistory();
    } catch (err) {
      alert("Delete failed.");
    }
  }

  function showSavedItem(item) {
    setOutputTitle("Saved Result");
    setOutputSubTitle("Previously saved result is shown below.");
    setResultTag("Saved");

    let html = `
      <div class="mb-6">
        <h4 class="text-lg font-semibold mb-2">Summary</h4>
        <p>${escapeHtml(item.summary || "")}</p>
      </div>
    `;

    if (item.points && item.points.length > 0) {
      html += `
        <div>
          <h4 class="text-lg font-semibold mb-2">Details</h4>
          <ul class="list-disc pl-5 space-y-2">
            ${item.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    setOutputHtml(html);
    setCurrentData({
      type: "saved",
      summary: item.summary || "",
      points: item.points || [],
    });
  }

  async function copyOutput() {
    if (!currentData || !currentData.summary) {
      alert("No result available to copy.");
      return;
    }

    let textToCopy = currentData.summary;

    if (currentData.points && currentData.points.length > 0) {
      textToCopy += "\n\nDetails:\n";
      currentData.points.forEach((item, index) => {
        textToCopy += `${index + 1}. ${item}\n`;
      });
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      alert("Copied!");
    } catch (err) {
      alert("Copy failed.");
    }
  }

  function logout() {
  localStorage.clear();
  window.location.href = "/?page=login";
}

  return (
    <div className={bodyClass}>
      <div className="min-h-screen flex">
        <aside className={sidebarClass}>
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold mb-6">
            N
          </div>

          <button
            type="button"
            onClick={resetWorkspace}
            className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex flex-col items-center justify-center text-xs font-medium hover:bg-emerald-200 transition"
          >
            <span className="text-2xl">＋</span>
            <span>New</span>
          </button>

          <div className="mt-6 flex flex-col gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={navClass(tab.key)}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-3 items-center">
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="w-12 h-12 rounded-2xl border border-slate-300 bg-white hover:bg-slate-100 transition text-xl"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-16 h-16 rounded-2xl text-red-500 flex flex-col items-center justify-center text-xs font-medium hover:bg-red-50 transition"
            >
              <span className="text-xl">⎋</span>
              <span>Exit</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto">
            <section className="text-center mb-8">
              <p className={`text-sm font-semibold mb-3 ${mutedTextClass}`}>Workspace</p>
              <h1 className={theme === "dark" ? "text-4xl md:text-6xl font-bold tracking-tight text-white" : "text-4xl md:text-6xl font-bold tracking-tight text-slate-900"}>
                 NoteGenius AI
              </h1>
              <p className={`max-w-4xl mx-auto mt-4 text-lg md:text-xl leading-8 ${mutedTextClass}`}>
                AI-powered workspace for summary, grammar, translation, PDF analysis, and chatbot support.
              </p>
            </section>

            <div className="grid xl:grid-cols-[1.12fr_0.88fr] gap-6">
              <div className={`${cardClass} p-5 md:p-6`}>
                {activeTab === "summary" && (
                  <section>
                    <div className="grid md:grid-cols-2 gap-4 mb-5">
                      <select
                        value={summaryLength}
                        onChange={(e) => setSummaryLength(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>

                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={12}
                      placeholder="Enter or paste your text here..."
                      className="w-full rounded-[28px] border border-slate-300 p-5 bg-white text-slate-900"
                    />

                    <button
                      type="button"
                      onClick={summarizeText}
                      className="mt-4 rounded-full bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700 transition"
                    >
                      {loading ? "Processing..." : "Summarize"}
                    </button>
                  </section>
                )}

                {activeTab === "grammar" && (
                  <section>
                    <textarea
                      value={grammarText}
                      onChange={(e) => setGrammarText(e.target.value)}
                      rows={12}
                      placeholder="Paste your text here for grammar review..."
                      className="w-full rounded-[28px] border border-slate-300 p-5 bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={checkGrammar}
                      className="mt-4 rounded-full bg-slate-900 text-white px-6 py-3 font-semibold hover:bg-slate-800 transition"
                    >
                      {loading ? "Processing..." : "Check Grammar"}
                    </button>
                  </section>
                )}

                {activeTab === "translate" && (
                  <section>
                    <textarea
                      value={translateText}
                      onChange={(e) => setTranslateText(e.target.value)}
                      rows={8}
                      placeholder="Paste text to translate..."
                      className="w-full rounded-[28px] border border-slate-300 p-5 bg-white text-slate-900"
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      <select
                        value={translateTarget}
                        onChange={(e) => setTranslateTarget(e.target.value)}
                        className="rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                      >
                        <option value="ta">Tamil</option>
                        <option value="hi">Hindi</option>
                        <option value="ml">Malayalam</option>
                      </select>

                      <button
                        type="button"
                        onClick={translateTextContent}
                        className="rounded-2xl bg-purple-600 text-white px-5 py-3 font-semibold hover:bg-purple-700 transition"
                      >
                        {loading ? "Processing..." : "Translate Text"}
                      </button>

                      <button
                        type="button"
                        onClick={translateCurrentSummary}
                        className="rounded-2xl bg-indigo-600 text-white px-5 py-3 font-semibold hover:bg-indigo-700 transition"
                      >
                        Use Current Summary
                      </button>
                    </div>
                  </section>
                )}

                {activeTab === "pdf" && (
                  <section>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => setPdfFile(e.target.files[0] || null)}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                    />

                    <button
                      type="button"
                      onClick={uploadPDF}
                      className="mt-4 rounded-2xl bg-blue-600 text-white px-6 py-3 font-semibold hover:bg-blue-700 transition"
                    >
                      {loading ? "Processing..." : "Upload PDF"}
                    </button>

                    <div className="mt-5">
                      {pdfPreview ? (
                        <div className="rounded-[28px] overflow-hidden border border-slate-200 bg-slate-50 h-[500px]">
                          <embed src={pdfPreview} type="application/pdf" className="w-full h-full" />
                        </div>
                      ) : (
                        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 h-[300px] flex items-center justify-center text-slate-400 text-sm">
                          PDF preview will appear here
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-semibold mb-3 text-slate-900">Ask from Document</h4>
                      <input
                        value={pdfQuestion}
                        onChange={(e) => setPdfQuestion(e.target.value)}
                        placeholder="Ask something from the uploaded PDF..."
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => askDoc(pdfQuestion)}
                        className="mt-3 rounded-2xl bg-slate-900 text-white px-5 py-3 hover:bg-slate-800 transition"
                      >
                        Ask Question
                      </button>
                    </div>
                  </section>
                )}

                {activeTab === "chatbot" && (
                  <section>
                    <input
                      value={chatbotQuestion}
                      onChange={(e) => setChatbotQuestion(e.target.value)}
                      placeholder="Ask a question about your current text or PDF..."
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-white text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => askDoc(chatbotQuestion)}
                      className="mt-4 rounded-2xl bg-slate-900 text-white px-6 py-3 font-semibold hover:bg-slate-800 transition"
                    >
                      Ask
                    </button>
                  </section>
                )}

                {activeTab === "history" && (
                  <section>
                    <h3 className="text-2xl font-semibold mb-4">Saved History</h3>

                    {historyItems.length === 0 ? (
                      <p className={mutedTextClass}>No saved results found.</p>
                    ) : (
                      <div className="space-y-4">
                        {historyItems.map((item) => (
                          <div key={item._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm text-slate-700 mb-2">{item.summary}</p>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => showSavedItem(item)}
                                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteHistoryItem(item._id)}
                                className="rounded-xl bg-red-500 text-white px-4 py-2 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className={`${cardClass} p-6 sticky top-6 h-fit`}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-2xl font-semibold">{outputTitle}</h3>
                    <p className={`text-sm mt-1 ${mutedTextClass}`}>{outputSubTitle}</p>
                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                    {resultTag}
                  </span>
                </div>

                <div
                  className={outputTextClass}
                  dangerouslySetInnerHTML={{
                    __html:
                      outputHtml ||
                      `<div class="rounded-[28px] border border-dashed border-slate-200 p-8 text-center text-slate-400">
                        No result yet. Choose a tool and start processing.
                      </div>`,
                  }}
                />

                <div className="flex flex-wrap gap-3 mt-5">
                  <button
                    type="button"
                    onClick={copyOutput}
                    className="rounded-full bg-slate-200 text-slate-800 px-5 py-3 font-medium hover:bg-slate-300 transition"
                  >
                    Copy Result
                  </button>

                  <button
                    type="button"
                    onClick={saveSummary}
                    className="rounded-full bg-emerald-600 text-white px-5 py-3 font-medium hover:bg-emerald-700 transition"
                  >
                    Save Result
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
