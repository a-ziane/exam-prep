const { json, readJson, setAuthCookies } = require("./_lib/http");
const { getAnonClient } = require("./_lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const { name, email, password } = body || {};
    if (!name || !email || !password || password.length < 8) {
      return json(res, 400, { error: "Name, email, and 8+ char password required" });
    }

    const supabase = getAnonClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) return json(res, 400, { error: error.message });
    if (data.session) setAuthCookies(res, data.session);

    return json(res, 200, { user: data.user });
  } catch (err) {
    return json(res, 500, { error: "Server error", detail: err.message });
  }
};
