const { json } = require("./_lib/http");
const { getAnonClient, supabaseUrl } = require("./_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const checks = { supabase: false, gemini: false };

  try {
    const supabase = getAnonClient();
    const { error } = await supabase.from("courses").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    );
    checks.gemini = response.ok;
  } catch {
    checks.gemini = false;
  }

  return json(res, 200, { ok: checks.supabase && checks.gemini, checks, supabaseUrl });
};
