const { json, readJson, setAuthCookies, clearAuthCookies } = require("./_lib/http");
const { getAnonClient } = require("./_lib/supabase");
const { requireUser } = require("./_lib/auth");

module.exports = async (req, res) => {
  const action = req.query.action;
  const isSecure = (req.headers["x-forwarded-proto"] || "").includes("https");

  if (req.method === "POST" && action === "signup") {
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
      if (data.session) setAuthCookies(res, data.session, isSecure);
      return json(res, 200, { user: data.user, session: data.session });
    } catch (err) {
      return json(res, 500, { error: "Server error", detail: err.message });
    }
  }

  if (req.method === "POST" && action === "login") {
    try {
      const body = await readJson(req);
      const { email, password } = body || {};
      if (!email || !password) {
        return json(res, 400, { error: "Email and password required" });
      }
      const supabase = getAnonClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return json(res, 401, { error: error.message });
      if (data.session) setAuthCookies(res, data.session, isSecure);
      return json(res, 200, { user: data.user, session: data.session });
    } catch (err) {
      return json(res, 500, { error: "Server error", detail: err.message });
    }
  }

  if (req.method === "POST" && action === "logout") {
    clearAuthCookies(res, isSecure);
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && action === "me") {
    const user = await requireUser(req, res);
    if (!user) return;
    return json(res, 200, { user: { id: user.id, email: user.email } });
  }

  return json(res, 405, { error: "Method not allowed" });
};
