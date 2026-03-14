const courseList = document.getElementById("courseList");
const courseStatus = document.getElementById("courseStatus");
const signoutBtn = document.getElementById("signoutBtn");

signoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "signin.html";
});

async function loadCourses() {
  try {
    const response = await fetch("/api/courses");
    if (response.status === 401) {
      window.location.href = "signin.html";
      return;
    }

    const data = await response.json();
    const courses = data.courses || [];

    if (!courses.length) {
      courseStatus.textContent = "No courses yet. Create one to get started.";
      courseList.innerHTML = "";
      return;
    }

    courseStatus.textContent = "";
    courseList.innerHTML = "";

    courses.forEach((course) => {
      const card = document.createElement("div");
      card.className = "course-card";
      card.innerHTML = `
        <div>
          <h3>${course.name}</h3>
          <p class="hint">${course.type}</p>
          <p class="hint">Last updated: ${new Date(course.updated_at).toLocaleDateString()}</p>
        </div>
        <div class="dashboard-actions">
          <a class="ghost" href="course.html?id=${course.id}">Edit</a>
          <a class="primary" href="lesson.html?id=${course.id}">Resume</a>
          <button class="ghost danger" data-delete="${course.id}">Delete</button>
        </div>
      `;
      courseList.appendChild(card);
    });

    courseList.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Delete this course? This cannot be undone.")) return;
        await fetch(`/api/courses/${id}`, { method: "DELETE" });
        loadCourses();
      });
    });
  } catch (err) {
    courseStatus.textContent = "Unable to load courses.";
  }
}

loadCourses();
