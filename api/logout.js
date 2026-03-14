const { json, clearAuthCookies } = require("./_lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  clearAuthCookies(res);
  return json(res, 200, { ok: true });
};
