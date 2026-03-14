const { json, readJson } = require("../_lib/http");
const { requireUser } = require("../_lib/auth");
const { getUserClient } = require("../_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);

  if (req.method === "POST") {
    const body = await readJson(req);
    const { courseId, lessonIndex, status, score, stage, slideIndex } = body || {};
    if (courseId == null || lessonIndex == null) {
      return json(res, 400, { error: "Missing courseId or lessonIndex" });
    }

    const { error } = await supabase
      .from("progress")
      .upsert({
        course_id: courseId,
        lesson_index: lessonIndex,
        status: status || "in_progress",
        score: score ?? null,
        stage: stage || "lesson",
        slide_index: slideIndex ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: "course_id,lesson_index" });

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
};
