const { getCookies, json } = require("./http");
const { jwtVerify } = require("jose");

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

async function verifyAccessToken(accessToken) {
  if (!jwtSecret || !accessToken) return null;
  try {
    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(jwtSecret)
    );
    return payload;
  } catch {
    return null;
  }
}

async function requireUser(req, res) {
  const cookies = getCookies(req);
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const accessToken = bearer || cookies.sb_access_token;
  if (!accessToken) {
    json(res, 401, { error: "Not authenticated" });
    return null;
  }
  const payload = await verifyAccessToken(accessToken);
  if (!payload?.sub) {
    json(res, 401, { error: "Not authenticated" });
    return null;
  }
  return { id: payload.sub, email: payload.email || null, accessToken };
}

module.exports = { requireUser, verifyAccessToken };
