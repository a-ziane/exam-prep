require("dotenv").config();

const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { db, init } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

init();

app.use(express.json({ limit: "4mb" }));
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: "./data" }),
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 18 * 1024 * 1024 } });

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function now() {
  return new Date().toISOString();
}

function buildPrompt(payload) {
  const {
    studentName,
    courseName,
    courseType,
    description,
    extraNotes = "",
  } = payload;

  return `You are an expert AI tutor and instructional designer.

Your task is to generate a COMPLETE structured study guide for a student based on the provided course information.

The output MUST be valid JSON and follow the exact schema described below. Do not include explanations, markdown, or extra text outside the JSON.

GOAL:
Create an interactive learning path where the student learns concept-by-concept. Each concept must be taught briefly, then immediately tested with a quiz and practice exercise.

Teaching style rules:
1. Each lesson must teach ONE core concept.
2. Each lesson should contain 1–3 slides maximum.
3. After every lesson include:
   - a concept check quiz
   - a small practice activity
4. Difficulty should gradually increase from easy → medium → mastery.
5. The final quiz must evaluate overall understanding.
6. Limit total lessons to 8 or fewer to keep the output concise and complete.

Adapt the teaching approach depending on the course subject:

If the course is MATHEMATICS or PHYSICS:
- Include worked examples.
- Include step-by-step problem solving.
- Practice problems should progress from easy → challenging → mastery.

If the course is COMPUTER SCIENCE:
- Include conceptual explanations and small code examples.
- Practice should include coding tasks or algorithm reasoning.

If the course is WRITING or HUMANITIES:
- Teach writing skills step-by-step (prewriting → thesis → outline → argument → revision).
- Practice tasks should involve short writing exercises.

If the course is BIOLOGY, SOCIOLOGY, HISTORY, or other MEMORY-HEAVY subjects:
- Focus on key concepts and definitions.
- Include recall questions and applied reasoning questions.

If the subject type is unclear:
- Default to conceptual explanation + applied examples.

LESSON DESIGN PRINCIPLES:
- Use simple clear explanations suitable for students.
- Use real-world examples.
- Keep slide content concise.
- Avoid long paragraphs.

INPUT DATA:
Course Name: ${courseName}
Course Description: ${description || ""}
Additional Materials: Attached files in this request.

If files or notes are provided, extract the key topics and structure lessons around them.

If insufficient information is provided, infer a reasonable curriculum based on the course name.

OUTPUT FORMAT (STRICT JSON ONLY):

{
  "courseSummary": {
    "goal": "Main learning objective of the course",
    "approach": "How the course teaches the material step-by-step",
    "prerequisites": ["list", "of", "recommended", "prior knowledge"]
  },
  "lessons": [
    {
      "title": "Lesson Title",
      "slides": [
        {
          "heading": "Concept heading",
          "content": "Clear explanation of the concept",
          "example": "Short example demonstrating the concept"
        }
      ],
      "stepQuiz": [
        {
          "question": "Concept check question",
          "type": "mcq | true_false | short",
          "choices": ["option1","option2","option3","option4"],
          "answer": "correct answer",
          "explanation": "why the answer is correct"
        }
      ],
      "practice": [
        {
          "prompt": "Practice activity for the student",
          "expected": "What a good answer or solution should include",
          "difficulty": "easy | medium | hard"
        }
      ]
    }
  ],
  "finalQuiz": [
    {
      "question": "Comprehensive question",
      "type": "mcq | short | true_false",
      "choices": [],
      "answer": "correct answer",
      "explanation": "why the answer is correct"
    }
  ],
  "evaluation": {
    "criteria": [
      "What skills demonstrate mastery",
      "Concept understanding",
      "Ability to apply knowledge"
    ],
    "masteryThreshold": "percentage required to pass",
    "gradingNotes": "How the system should interpret student performance"
  }
}

STRICT RULES:
- Output JSON only.
- Follow the schema exactly.
- No markdown.
- No commentary outside JSON.
- Ensure quizzes and practice directly test the lesson concept.
`;
}

function parseJsonSafe(text) {
  if (!text) return null;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const objStart = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  let start = -1;
  let end = -1;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    end = raw.lastIndexOf("]");
  } else {
    start = objStart;
    end = raw.lastIndexOf("}");
  }
  if (start === -1 || end === -1) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    return null;
  }
}

const responseSchema = {
  type: "object",
  properties: {
    courseSummary: {
      type: "object",
      properties: {
        goal: { type: "string" },
        approach: { type: "string" },
        prerequisites: { type: "array", items: { type: "string" } },
      },
      required: ["goal", "approach", "prerequisites"],
    },
    lessons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                content: { type: "string" },
                example: { type: "string" },
              },
              required: ["heading", "content", "example"],
            },
          },
          stepQuiz: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                type: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                answer: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["question", "type", "answer", "explanation"],
            },
          },
          practice: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                expected: { type: "string" },
                difficulty: { type: "string" },
              },
              required: ["prompt", "expected", "difficulty"],
            },
          },
        },
        required: ["title", "slides", "stepQuiz", "practice"],
      },
    },
    finalQuiz: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          type: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["question", "type", "answer", "explanation"],
      },
    },
    evaluation: {
      type: "object",
      properties: {
        criteria: { type: "array", items: { type: "string" } },
        masteryThreshold: { type: "string" },
        gradingNotes: { type: "string" },
      },
      required: ["criteria", "masteryThreshold", "gradingNotes"],
    },
  },
  required: ["courseSummary", "lessons", "finalQuiz", "evaluation"],
};

app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: "Name, email, and 8+ char password required" });
  }

  const hash = await bcrypt.hash(password, 10);
  const createdAt = now();

  db.run(
    "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
    [name, email.toLowerCase(), hash, createdAt],
    function (err) {
      if (err) {
        return res.status(400).json({ error: "Email already in use" });
      }
      req.session.userId = this.lastID;
      res.json({ user: { id: this.lastID, name, email } });
    }
  );
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email.toLowerCase()], async (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = row.id;
    res.json({ user: { id: row.id, name: row.name, email: row.email } });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  db.get("SELECT id, name, email FROM users WHERE id = ?", [req.session.userId], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user: row });
  });
});

app.get("/api/courses", requireAuth, (req, res) => {
  db.all(
    `SELECT c.*, g.id as guide_id, g.created_at as guide_created
     FROM courses c
     LEFT JOIN guides g ON g.id = (
       SELECT id FROM guides WHERE course_id = c.id ORDER BY created_at DESC LIMIT 1
     )
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC`,
    [req.session.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to load courses" });
      res.json({ courses: rows });
    }
  );
});

app.get("/api/courses/:id", requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM courses WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.userId],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Course not found" });
      res.json({ course: row });
    }
  );
});

app.get("/api/courses/:id/guide", requireAuth, (req, res) => {
  db.get(
    "SELECT * FROM guides WHERE course_id = ? ORDER BY created_at DESC LIMIT 1",
    [req.params.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Guide not found" });
      res.json({ guide: row });
    }
  );
});

app.post("/api/grade", requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    }

    const { question, type, choices, answerKey, userAnswer } = req.body || {};
    if (!question || !userAnswer) {
      return res.status(400).json({ error: "Missing question or userAnswer" });
    }

    const prompt = `You are an AI grader. Grade the student's answer.\n\n` +
      `Question: ${question}\n` +
      `Type: ${type || "short"}\n` +
      `Choices: ${(choices || []).join(" | ")}\n` +
      `Expected answer (if provided): ${answerKey || "(none)"}\n` +
      `Student answer: ${userAnswer}\n\n` +
      `Return ONLY valid JSON with this schema:\n` +
      `{"correct": boolean, "feedback": string, "suggestedAnswer": string}\n` +
      `Be strict for MCQ/true_false. Be flexible for short answers.`;

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Gemini API error", detail: text });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    const json = parseJsonSafe(text);
    if (!json) {
      return res.status(502).json({ error: "Invalid grader JSON", detail: text.slice(0, 300) });
    }

    res.json(json);
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

app.post("/api/final-quiz/:courseId/regen", requireAuth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
    }

    const courseId = req.params.courseId;
    db.get(
      "SELECT * FROM guides WHERE course_id = ? ORDER BY created_at DESC LIMIT 1",
      [courseId],
      async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Guide not found" });
        const guide = row.json_text ? JSON.parse(row.json_text) : null;
        if (!guide) return res.status(400).json({ error: "Guide JSON missing" });

        const prompt = `Generate a NEW final quiz for this course.\n\n` +
          `Course summary: ${JSON.stringify(guide.courseSummary || {})}\n` +
          `Lesson titles: ${(guide.lessons || []).map((l) => l.title).join(" | ")}\n\n` +
          `Return ONLY valid JSON array in this schema:\n` +
          `[{\"question\": string, \"type\": \"mcq\"|\"short\"|\"true_false\", \"choices\": [string], \"answer\": string, \"explanation\": string}]\n` +
          `Keep it 5-8 questions and cover the course broadly.`;

        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (!response.ok) {
          const text = await response.text();
          return res.status(500).json({ error: "Gemini API error", detail: text });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        const finalQuiz = parseJsonSafe(text);
        if (!Array.isArray(finalQuiz)) {
          return res.status(502).json({ error: "Invalid final quiz JSON", detail: text.slice(0, 300) });
        }

        guide.finalQuiz = finalQuiz;
        db.run(
          "UPDATE guides SET json_text = ? WHERE id = ?",
          [JSON.stringify(guide), row.id],
          (updateErr) => {
            if (updateErr) return res.status(500).json({ error: "Failed to save final quiz" });
            return res.json({ finalQuiz });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: err.message });
  }
});

app.delete("/api/courses/:id", requireAuth, (req, res) => {
  const courseId = req.params.id;
  db.serialize(() => {
    db.run("DELETE FROM progress WHERE course_id = ?", [courseId]);
    db.run("DELETE FROM materials WHERE course_id = ?", [courseId]);
    db.run("DELETE FROM guides WHERE course_id = ?", [courseId]);
    db.run(
      "DELETE FROM courses WHERE id = ? AND user_id = ?",
      [courseId, req.session.userId],
      function (err) {
        if (err) return res.status(500).json({ error: "Failed to delete course" });
        if (this.changes === 0) return res.status(404).json({ error: "Course not found" });
        return res.json({ ok: true });
      }
    );
  });
});

app.get("/api/progress/:courseId", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM progress WHERE course_id = ?",
    [req.params.courseId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Failed to load progress" });
      res.json({ progress: rows });
    }
  );
});

app.post("/api/progress", requireAuth, (req, res) => {
  const { courseId, lessonIndex, status, score, stage, slideIndex } = req.body || {};
  if (courseId == null || lessonIndex == null) {
    return res.status(400).json({ error: "Missing courseId or lessonIndex" });
  }

  const updatedAt = now();
  db.run(
    `INSERT INTO progress (course_id, lesson_index, status, score, updated_at, stage, slide_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(course_id, lesson_index)
     DO UPDATE SET status = excluded.status, score = excluded.score, updated_at = excluded.updated_at,
      stage = excluded.stage, slide_index = excluded.slide_index`,
    [courseId, lessonIndex, status || "not_started", score ?? null, updatedAt, stage || "lesson", slideIndex ?? 0],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to save progress" });
      res.json({ ok: true });
    }
  );
});

app.post("/api/generate", requireAuth, upload.array("files"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY. Add it to your environment and restart the server.",
      });
    }

    const { courseId, courseName, courseType, description, extraNotes } = req.body || {};
    if (!courseName || !courseType) {
      return res.status(400).json({ error: "Course name and type required" });
    }

    const files = req.files || [];
    const fileParts = files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype || "application/octet-stream",
        data: file.buffer.toString("base64"),
      },
    }));

    const payload = {
      studentName: "Student",
      courseName,
      courseType,
      description,
      extraNotes,
    };

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const basePrompt = buildPrompt(payload);

    const callGemini = async (promptText, maxTokens) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: promptText }, ...fileParts],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: maxTokens,
              responseMimeType: "application/json",
              responseSchema,
            },
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Gemini API error");
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      return { text, json: parseJsonSafe(text) };
    };

    let result = await callGemini(
      basePrompt,
      Number(process.env.GEMINI_MAX_TOKENS || 8192)
    );

    if (!result.json) {
      const retryPrompt = `${basePrompt}\n\nIMPORTANT RETRY:\n- Keep the output SHORT.\n- Limit to 5 lessons max.\n- Each lesson must have 1 slide only.\n- Keep explanations and examples under 2 sentences.\n- Output JSON only.`;
      result = await callGemini(retryPrompt, 4096);
    }

    const text = result.text;
    const json = result.json;
    const createdAt = now();

    if (!json) {
      return res.status(502).json({
        error: "Model did not return valid JSON. Please retry generation.",
        detail: text.slice(0, 500),
      });
    }

    const finalizeResponse = (courseIdFinal) => {
      db.run(
        "INSERT INTO guides (course_id, raw_text, json_text, created_at) VALUES (?, ?, ?, ?)",
        [courseIdFinal, text, json ? JSON.stringify(json) : null, createdAt],
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to save guide" });
          return res.json({ raw: text, courseId: courseIdFinal });
        }
      );
    };

    if (courseId) {
      db.run(
        "UPDATE courses SET name = ?, type = ?, description = ?, extra_notes = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [courseName, courseType, description || "", extraNotes || "", createdAt, courseId, req.session.userId],
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to update course" });

          db.run("DELETE FROM materials WHERE course_id = ?", [courseId], (delErr) => {
            if (delErr) return res.status(500).json({ error: "Failed to refresh materials" });

            const stmt = db.prepare(
              "INSERT INTO materials (course_id, name, type, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
            );
            files.forEach((f) => {
              stmt.run([courseId, f.originalname, f.mimetype || "unknown", "binary", null, createdAt]);
            });
            stmt.finalize(() => finalizeResponse(courseId));
          });
        }
      );
    } else {
      db.run(
        "INSERT INTO courses (user_id, name, type, description, extra_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          req.session.userId,
          courseName,
          courseType,
          description || "",
          extraNotes || "",
          createdAt,
          createdAt,
        ],
        function (err) {
          if (err) return res.status(500).json({ error: "Failed to create course" });

          const newCourseId = this.lastID;
          const stmt = db.prepare(
            "INSERT INTO materials (course_id, name, type, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          );
          files.forEach((f) => {
            stmt.run([newCourseId, f.originalname, f.mimetype || "unknown", "binary", null, createdAt]);
          });
          stmt.finalize(() => finalizeResponse(newCourseId));
        }
      );
    }
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
