const { json } = require("../../_lib/http");
const { requireUser } = require("../../_lib/auth");
const { getUserClient } = require("../../_lib/supabase");

function parseJsonSafe(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const objStart = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  let start = -1;
  let end = -1;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    end = raw.lastIndexOf("]");
  } else {
    start = objStart;
    end = raw.lastIndexOf("}");
  }
  if (start === -1 || end === -1) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
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

    const courseId = req.query.courseId;
    const supabase = getUserClient(user.accessToken);

    const { data: guide, error } = await supabase
      .from("guides")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !guide) return json(res, 404, { error: "Guide not found" });
    const guideJson = guide.json_text ? JSON.parse(guide.json_text) : null;
    if (!guideJson) return json(res, 400, { error: "Guide JSON missing" });

    const prompt = `Generate a NEW final quiz for this course.\n\n` +
      `Course summary: ${JSON.stringify(guideJson.courseSummary || {})}\n` +
      `Lesson titles: ${(guideJson.lessons || []).map((l) => l.title).join(" | ")}\n\n` +
      `Return ONLY valid JSON array in this schema:\n` +
      `[{"question": string, "type": "mcq"|"short"|"true_false", "choices": [string], "answer": string, "explanation": string}]\n` +
      `Keep it 5-8 questions and cover the course broadly.`;

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
            temperature: 0.4,
            maxOutputTokens: 1024,
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
    const finalQuiz = parseJsonSafe(text);
    if (!Array.isArray(finalQuiz)) {
      return json(res, 502, { error: "Invalid final quiz JSON", detail: text.slice(0, 300) });
    }

    guideJson.finalQuiz = finalQuiz;
    await supabase.from("guides").update({ json_text: JSON.stringify(guideJson) }).eq("id", guide.id);

    return json(res, 200, { finalQuiz });
  } catch (err) {
    return json(res, 500, { error: "Server error", detail: err.message });
  }
};
