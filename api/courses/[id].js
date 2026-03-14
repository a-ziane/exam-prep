const { json } = require("../_lib/http");
const { requireUser } = require("../_lib/auth");
const { getUserClient } = require("../_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);
  const id = req.query.id;

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) return json(res, 404, { error: "Course not found" });
    return json(res, 200, { course: data });
  }

  if (req.method === "DELETE") {
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
