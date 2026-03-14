export function getAuthToken() {
  return localStorage.getItem("sb_access_token") || "";
}

export async function apiFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export function clearAuthToken() {
  localStorage.removeItem("sb_access_token");
}
