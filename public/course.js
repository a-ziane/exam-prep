import { apiFetch, clearAuthToken } from "./api.js";

const courseForm = document.getElementById("courseForm");
const fileInput = document.getElementById("courseFiles");
const statusEl = document.getElementById("status");
const signoutBtn = document.getElementById("signoutBtn");
const courseTitle = document.getElementById("courseTitle");

let courseId = null;
let focusNotes = "";

const params = new URLSearchParams(window.location.search);
if (params.get("id")) {
  courseId = params.get("id");
  courseTitle.textContent = "Update course";
}
if (params.get("focus")) {
  focusNotes = params.get("focus");
}

signoutBtn.addEventListener("click", async () => {
  await apiFetch("/api/auth?action=logout", { method: "POST" });
  clearAuthToken();
  window.location.href = "signin.html";
});

function setStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.style.color = tone === "error" ? "#b4232b" : "#5f6b7a";
}

async function loadCourse() {
  if (!courseId) return;
  const courseRes = await apiFetch(`/api/courses?action=one&id=${courseId}`);
  if (courseRes.status === 401) return (window.location.href = "signin.html");
  const courseData = await courseRes.json();
  if (courseData.course) {
    courseForm.courseName.value = courseData.course.name;
    courseForm.courseType.value = courseData.course.type;
    courseForm.description.value = courseData.course.description || "";
    const baseNotes = courseData.course.extra_notes || "";
    courseForm.extraNotes.value = focusNotes ? `${baseNotes}\n\nFocus areas:\n${focusNotes}`.trim() : baseNotes;
  }
}

courseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Building your study guide with Gemini...");

  const formData = new FormData(courseForm);
  const payload = new FormData();
  payload.append("courseName", formData.get("courseName"));
  payload.append("courseType", formData.get("courseType"));
  payload.append("description", formData.get("description"));
  payload.append("extraNotes", formData.get("extraNotes"));
  if (courseId) payload.append("courseId", courseId);

  for (const file of fileInput.files || []) {
    payload.append("files", file);
  }

  try {
    const response = await apiFetch("/api/ai?action=generate", {
      method: "POST",
      body: payload,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate guide");
    }

    courseId = data.courseId;
    setStatus("Guide ready. Opening the lesson player...");
    window.location.href = `lesson.html?id=${courseId}`;
  } catch (error) {
    setStatus(error.message, "error");
  }
});

loadCourse();
