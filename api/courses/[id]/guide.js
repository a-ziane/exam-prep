const { json } = require("../../_lib/http");
const { requireUser } = require("../../_lib/auth");
const { getUserClient } = require("../../_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);
  const id = req.query.id;

  if (req.method === "GET") {
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

  return json(res, 405, { error: "Method not allowed" });
};
