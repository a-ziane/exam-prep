const signupForm = document.getElementById("signupForm");
const signinForm = document.getElementById("signinForm");
const statusEl = document.getElementById("authStatus");

function getBaseUrl() {
  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

async function authRequest(action, payload) {
  try {
    const base = getBaseUrl();
    const response = await fetch(`${base}/api/auth?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Auth failed");

    window.location.href = "dashboard.html";
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message;
  }
}

if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const payload = Object.fromEntries(formData.entries());
    await authRequest("signup", payload);
  });
}

if (signinForm) {
  signinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signinForm);
    const payload = Object.fromEntries(formData.entries());
    await authRequest("login", payload);
  });
}
