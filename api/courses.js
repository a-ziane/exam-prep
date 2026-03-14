const { json, readJson } = require("./_lib/http");
const { requireUser } = require("./_lib/auth");
const { getUserClient } = require("./_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);
  const action = req.query.action;

  if (req.method === "GET" && action === "list") {
    const { data, error } = await supabase
      .from("courses")
      .select("*, guides:guides(id, created_at)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return json(res, 500, { error: error.message });

    const courses = (data || []).map((course) => ({
      ...course,
      guide_id: course.guides?.[0]?.id || null,
      guide_created: course.guides?.[0]?.created_at || null,
      guides: undefined,
    }));

    return json(res, 200, { courses });
  }

  if (req.method === "GET" && action === "one") {
    const id = req.query.id;
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) return json(res, 404, { error: "Course not found" });
    return json(res, 200, { course: data });
  }

  if (req.method === "GET" && action === "guide") {
    const id = req.query.id;
    const { data, error } = await supabase
      .from("guides")
      .select("*")
      .eq("course_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) return json(res, 404, { error: "Guide not found" });
    return json(res, 200, { guide: data });
  }

  if (req.method === "GET" && action === "progress") {
    const courseId = req.query.courseId;
    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .eq("course_id", courseId)
      .order("lesson_index", { ascending: true });

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { progress: data || [] });
  }

  if (req.method === "POST" && action === "progress") {
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

  if (req.method === "DELETE" && action === "delete") {
    const id = req.query.id;
    await supabase.from("progress").delete().eq("course_id", id);
    await supabase.from("materials").delete().eq("course_id", id);
    await supabase.from("guides").delete().eq("course_id", id);
    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
};
