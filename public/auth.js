const signupForm = document.getElementById("signupForm");
const signinForm = document.getElementById("signinForm");
const statusEl = document.getElementById("authStatus");

async function authRequest(url, payload) {
  try {
    const response = await fetch(url, {
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
    await authRequest("/api/signup", payload);
  });
}

if (signinForm) {
  signinForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signinForm);
    const payload = Object.fromEntries(formData.entries());
    await authRequest("/api/login", payload);
  });
}
