const { json } = require("./_lib/http");
const { requireUser } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const user = await requireUser(req, res);
  if (!user) return;
  return json(res, 200, { user: { id: user.id, email: user.email } });
};
