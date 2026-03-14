const lessonStage = document.getElementById("lessonStage");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const nextLessonBtn = document.getElementById("nextLessonBtn");
const prevLessonBtn = document.getElementById("prevLessonBtn");
const firstLessonBtn = document.getElementById("firstLessonBtn");
const lessonIndicator = document.getElementById("lessonIndicator");
const goFinalQuiz = document.getElementById("goFinalQuiz");
const signoutBtn = document.getElementById("signoutBtn");

let courseId = null;
let guide = null;
let lessonIndex = 0;
let stage = "lesson"; // lesson or quiz or final
let slideIndex = 0;
let results = {};

const params = new URLSearchParams(window.location.search);
if (params.get("id")) {
  courseId = Number(params.get("id"));
}

if (goFinalQuiz) {
  goFinalQuiz.href = courseId ? `final.html?id=${courseId}` : "final.html";
}

signoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "signin.html";
});

nextBtn.addEventListener("click", async () => {
  if (!guide) return;

  if (stage === "lesson") {
    if (slideIndex < (guide.lessons?.[lessonIndex]?.slides || []).length - 1) {
      slideIndex += 1;
    } else {
      stage = "quiz";
    }
  } else if (stage === "quiz") {
    if (lessonIndex < (guide.lessons || []).length - 1) {
      lessonIndex += 1;
      stage = "lesson";
      slideIndex = 0;
    } else {
      stage = "final";
    }
  }

  await saveProgress();
  renderLesson();
});

prevBtn.addEventListener("click", async () => {
  if (!guide) return;

  if (stage === "quiz") {
    stage = "lesson";
  } else if (stage === "lesson") {
    if (slideIndex > 0) {
      slideIndex -= 1;
    } else if (lessonIndex > 0) {
      lessonIndex -= 1;
      stage = "quiz";
      slideIndex = (guide.lessons?.[lessonIndex]?.slides || []).length - 1;
    }
  } else if (stage === "final") {
    stage = "quiz";
  }

  await saveProgress();
  renderLesson();
});

nextLessonBtn?.addEventListener("click", async () => {
  if (!guide) return;
  if (lessonIndex < (guide.lessons || []).length - 1) {
    lessonIndex += 1;
    stage = "lesson";
    slideIndex = 0;
    await saveProgress();
    renderLesson();
  }
});

prevLessonBtn?.addEventListener("click", async () => {
  if (!guide) return;
  if (lessonIndex > 0) {
    lessonIndex -= 1;
    stage = "lesson";
    slideIndex = 0;
    await saveProgress();
    renderLesson();
  }
});

firstLessonBtn?.addEventListener("click", async () => {
  if (!guide) return;
  lessonIndex = 0;
  stage = "lesson";
  slideIndex = 0;
  await saveProgress();
  renderLesson();
});

async function saveProgress() {
  if (!courseId) return;
  await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId,
      lessonIndex,
      status: stage === "final" ? "complete" : "in_progress",
      stage,
      slideIndex,
    }),
  });
}

function renderLesson() {
  lessonStage.innerHTML = "";

  if (!guide) {
    lessonStage.innerHTML = `
      <div class="lesson">
        <h3>No guide found</h3>
        <p class="hint">Generate a study guide in the course builder first.</p>
        <a class="primary" href="course.html?id=${courseId || ""}">Go to course builder</a>
      </div>
    `;
    return;
  }

  if (stage === "final") {
    lessonStage.innerHTML = `<p class="hint">You reached the final quiz. Scroll to the evaluation section.</p>`;
    return;
  }

  const lesson = guide.lessons?.[lessonIndex];
  if (!lesson) {
    lessonStage.innerHTML = `<p class="hint">No lessons found.</p>`;
    return;
  }

  if (stage === "lesson") {
    const slide = lesson.slides?.[slideIndex];
    lessonStage.innerHTML = `
      <div class="lesson">
        <h3>${lesson.title}</h3>
        <div class="slide">
          <h4>${slide?.heading || ""}</h4>
          <p>${slide?.content || ""}</p>
          <p><em>Example:</em> ${slide?.example || ""}</p>
        </div>
        <p class="hint">Slide ${slideIndex + 1} of ${(lesson.slides || []).length}</p>
      </div>
    `;
    if (lessonIndicator) {
      lessonIndicator.textContent = `Lesson ${lessonIndex + 1} of ${(guide.lessons || []).length}`;
    }
    return;
  }

  if (stage === "quiz") {
    const quiz = lesson.stepQuiz || [];
    lessonStage.innerHTML = `
      <div class="lesson">
        <h3>${lesson.title} quiz</h3>
        ${quiz
          .map((item, idx) => {
            const choices = item.choices && item.choices.length
              ? item.choices
              : item.type === "true_false"
                ? ["True", "False"]
                : [];
            const choiceHtml = choices
              .map(
                (choice, cIdx) => `
                  <label class="choice">
                    <input type="radio" name="q${idx}" value="${escapeHtml(choice)}" />
                    <span>${escapeHtml(choice)}</span>
                  </label>
                `
              )
              .join("");
            const shortInput =
              item.type === "short"
                ? `<input class="short-answer" type="text" name="q${idx}" placeholder="Type your answer" />`
                : "";
            return `
              <div class="quiz-item" data-quiz-index="${idx}">
                <p>${escapeHtml(item.question)}</p>
                ${choiceHtml || shortInput || `<p class="hint">No choices provided.</p>`}
                <button class="ghost" data-check>Check answer</button>
                <p class="hint" data-feedback></p>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    lessonStage.querySelectorAll("[data-check]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const container = btn.closest("[data-quiz-index]");
        const idx = Number(container.dataset.quizIndex);
        const item = quiz[idx];
        const feedback = container.querySelector("[data-feedback]");
        let userAnswer = "";

        if (item.type === "short") {
          userAnswer = container.querySelector(".short-answer")?.value?.trim() || "";
        } else {
          const selected = container.querySelector("input[type='radio']:checked");
          userAnswer = selected ? selected.value : "";
        }

        if (!userAnswer) {
          feedback.textContent = "Select or enter an answer first.";
          return;
        }

        feedback.textContent = "Checking...";
        gradeAnswer(item, userAnswer)
          .then((result) => {
            feedback.textContent = result.correct
              ? `Correct! ${result.feedback || ""}`
              : `Not quite. ${result.feedback || ""} Suggested: ${result.suggestedAnswer || item.answer}`;
            recordResult({
              kind: "step",
              lessonTitle: lesson.title,
              question: item.question,
              correct: result.correct,
            });
          })
          .catch((err) => {
            feedback.textContent = err.message;
          });
      });
    });
    if (lessonIndicator) {
      lessonIndicator.textContent = `Lesson ${lessonIndex + 1} of ${(guide.lessons || []).length}`;
    }
  }
}

function renderEvaluation() {}

function safeParseJSON(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    return null;
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function loadResults() {
  if (!courseId) return;
  const raw = localStorage.getItem(`results:${courseId}`);
  if (raw) {
    try {
      results = JSON.parse(raw) || {};
    } catch {
      results = {};
    }
  }
}

function saveResults() {
  if (!courseId) return;
  localStorage.setItem(`results:${courseId}`, JSON.stringify(results));
}

function recordResult(entry) {
  const key = `${entry.kind}:${entry.lessonTitle}:${entry.question}`;
  results[key] = entry;
  saveResults();
}

function buildFocusNotes() {
  const wrong = Object.values(results).filter((r) => !r.correct);
  if (!wrong.length) return "No weak areas detected. Create deeper practice for the whole course.";
  const grouped = new Map();
  wrong.forEach((r) => {
    const key = r.lessonTitle;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r.question);
  });
  return Array.from(grouped.entries())
    .map(([lesson, qs]) => `${lesson}: ${qs.join(" | ")}`)
    .join("\n");
}

function renderScoreSummary() {}

async function gradeAnswer(item, userAnswer) {
  const response = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: item.question,
      type: item.type,
      choices: item.choices || [],
      answerKey: item.answer,
      userAnswer,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Grading failed");
  return data;
}

async function loadLesson() {
  if (!courseId) {
    lessonStage.innerHTML = `<p class="hint">No course selected.</p>`;
    return;
  }

  const guideRes = await fetch(`/api/courses/${courseId}/guide`);
  if (guideRes.status === 401) return (window.location.href = "signin.html");

  if (guideRes.ok) {
    const guideData = await guideRes.json();
    const jsonText = guideData.guide?.json_text || "";
    guide = jsonText ? JSON.parse(jsonText) : safeParseJSON(guideData.guide?.raw_text || "");
  }

  const progressRes = await fetch(`/api/progress/${courseId}`);
  if (progressRes.ok) {
    const progressData = await progressRes.json();
    const last = (progressData.progress || []).sort((a, b) => b.lesson_index - a.lesson_index)[0];
    if (last) {
      lessonIndex = last.lesson_index || 0;
      stage = last.stage || "lesson";
      slideIndex = last.slide_index || 0;
    }
  }

  renderLesson();
}

loadResults();
loadLesson();
