const cookie = require("cookie");

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function getCookies(req) {
  return cookie.parse(req.headers.cookie || "");
}

function setAuthCookies(res, session, secure = true) {
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  const opts = {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  res.setHeader(
    "Set-Cookie",
    [
      cookie.serialize("sb_access_token", access || "", opts),
      cookie.serialize("sb_refresh_token", refresh || "", opts),
    ]
  );
}

function clearAuthCookies(res, secure = true) {
  const opts = {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: 0,
  };
  res.setHeader(
    "Set-Cookie",
    [
      cookie.serialize("sb_access_token", "", opts),
      cookie.serialize("sb_refresh_token", "", opts),
    ]
  );
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { json, getCookies, setAuthCookies, clearAuthCookies, readJson };
