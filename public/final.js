const finalQuizEl = document.getElementById("finalQuiz");
const regenFinalBtn = document.getElementById("regenFinal");
const signoutBtn = document.getElementById("signoutBtn");
const backToLesson = document.getElementById("backToLesson");

let courseId = null;
let guide = null;

const params = new URLSearchParams(window.location.search);
if (params.get("id")) {
  courseId = params.get("id");
}

backToLesson.href = courseId ? `lesson.html?id=${courseId}` : "lesson.html";

signoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth?action=logout", { method: "POST" });
  window.location.href = "signin.html";
});

regenFinalBtn.addEventListener("click", async () => {
  if (!courseId) return;
  regenFinalBtn.disabled = true;
  regenFinalBtn.textContent = "Regenerating...";
  try {
    const response = await fetch(`/api/ai?action=finalQuizRegen&courseId=${courseId}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to regenerate");
    guide.finalQuiz = data.finalQuiz;
    renderFinalQuiz();
  } catch (err) {
    alert(err.message);
  } finally {
    regenFinalBtn.disabled = false;
    regenFinalBtn.textContent = "Regenerate final quiz";
  }
});

async function gradeAnswer(item, userAnswer) {
  const response = await fetch("/api/ai?action=grade", {
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

function renderFinalQuiz() {
  if (!guide || !guide.finalQuiz) {
    finalQuizEl.innerHTML = `<p class="hint">No final quiz found.</p>`;
    return;
  }

  const finalQuiz = guide.finalQuiz || [];
  finalQuizEl.innerHTML = `
    ${finalQuiz
      .map((item, idx) => {
        const choices = item.choices && item.choices.length
          ? item.choices
          : item.type === "true_false"
            ? ["True", "False"]
            : [];
        const choiceHtml = choices
          .map(
            (choice) => `
            <label class="choice">
              <input type="radio" name="final${idx}" value="${escapeHtml(choice)}" />
              <span>${escapeHtml(choice)}</span>
            </label>
          `
          )
          .join("");
        const shortInput =
          item.type === "short"
            ? `<input class="short-answer" type="text" name="final${idx}" placeholder="Type your answer" />`
            : "";
        return `
          <div class="quiz-item" data-final-index="${idx}">
            <p>${escapeHtml(item.question)}</p>
            ${choiceHtml || shortInput || `<p class="hint">No choices provided.</p>`}
            <button class="ghost" data-final-check>Check answer</button>
            <p class="hint" data-final-feedback></p>
          </div>
        `;
      })
      .join("")}
  `;

  finalQuizEl.querySelectorAll("[data-final-check]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const container = btn.closest("[data-final-index]");
      const idx = Number(container.dataset.finalIndex);
      const item = finalQuiz[idx];
      const feedback = container.querySelector("[data-final-feedback]");
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
      try {
        const result = await gradeAnswer(item, userAnswer);
        feedback.textContent = result.correct
          ? `Correct! ${result.feedback || ""}`
          : `Not quite. ${result.feedback || ""} Suggested: ${result.suggestedAnswer || item.answer}`;
      } catch (err) {
        feedback.textContent = err.message;
      }
    });
  });
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadFinalQuiz() {
  if (!courseId) {
    finalQuizEl.innerHTML = `<p class="hint">No course selected.</p>`;
    return;
  }

  const guideRes = await fetch(`/api/courses?action=guide&id=${courseId}`);
  if (guideRes.status === 401) return (window.location.href = "signin.html");

  if (guideRes.ok) {
    const guideData = await guideRes.json();
    guide = guideData.guide?.json_text ? JSON.parse(guideData.guide.json_text) : null;
  }

  renderFinalQuiz();
}

loadFinalQuiz();
