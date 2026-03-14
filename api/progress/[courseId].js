const { json } = require("../_lib/http");
const { requireUser } = require("../_lib/auth");
const { getUserClient } = require("../_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);
  const courseId = req.query.courseId;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("progress")
      .select("*")
      .eq("course_id", courseId)
      .order("lesson_index", { ascending: true });

    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { progress: data || [] });
  }

  return json(res, 405, { error: "Method not allowed" });
};
