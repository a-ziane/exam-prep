const { json } = require("../_lib/http");
const { requireUser } = require("../_lib/auth");
const { getUserClient } = require("../_lib/supabase");

module.exports = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = getUserClient(user.accessToken);

  if (req.method === "GET") {
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

  return json(res, 405, { error: "Method not allowed" });
};
