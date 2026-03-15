const { json, getCookies } = require("./_lib/http");
const { verifyAccessToken } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const cookies = getCookies(req);
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const token = bearer || cookies.sb_access_token || "";
  const payload = await verifyAccessToken(token);
  return json(res, 200, {
    hasAuthHeader: Boolean(header),
    hasCookie: Boolean(cookies.sb_access_token),
    tokenLength: token.length,
    jwtSecretSet: Boolean(process.env.SUPABASE_JWT_SECRET),
    payloadSub: payload?.sub || null,
  });
};
