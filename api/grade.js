const { json, readJson } = require("./_lib/http");
const { requireUser } = require("./_lib/auth");

function parseJsonSafe(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(res, 500, { error: "Missing GEMINI_API_KEY" });

    const body = await readJson(req);
    const { question, type, choices, answerKey, userAnswer } = body || {};
    if (!question || !userAnswer) {
      return json(res, 400, { error: "Missing question or userAnswer" });
    }

    const prompt = `You are an AI grader. Grade the student's answer.\n\n` +
      `Question: ${question}\n` +
      `Type: ${type || "short"}\n` +
      `Choices: ${(choices || []).join(" | ")}\n` +
      `Expected answer (if provided): ${answerKey || "(none)"}\n` +
      `Student answer: ${userAnswer}\n\n` +
      `Return ONLY valid JSON with this schema:\n` +
      `{"correct": boolean, "feedback": string, "suggestedAnswer": string}\n` +
      `Be strict for MCQ/true_false. Be flexible for short answers.`;

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return json(res, 500, { error: "Gemini API error", detail: text });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    const parsed = parseJsonSafe(text);
    if (!parsed) return json(res, 502, { error: "Invalid grader JSON" });

    return json(res, 200, parsed);
  } catch (err) {
    return json(res, 500, { error: "Server error", detail: err.message });
  }
};
