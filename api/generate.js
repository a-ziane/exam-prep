const Busboy = require("busboy");
const { json } = require("./_lib/http");
const { requireUser } = require("./_lib/auth");
const { getUserClient } = require("./_lib/supabase");

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 8 * 1024 * 1024 } });
    const fields = {};
    const files = [];

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      file.on("data", (data) => chunks.push(data));
      file.on("end", () => {
        const buffer = Buffer.concat(chunks);
        files.push({ filename, mimeType, buffer });
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ fields, files }));
    req.pipe(busboy);
  });
}

function buildPrompt(payload) {
  const { courseName, description } = payload;

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
6. Limit total lessons to 8 or fewer.

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

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { fields, files } = await parseMultipart(req);
    const { courseId, courseName, courseType, description, extraNotes } = fields;

    if (!courseName || !courseType) {
      return json(res, 400, { error: "Course name and type required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(res, 500, { error: "Missing GEMINI_API_KEY" });

    const fileParts = (files || []).map((file) => ({
      inlineData: {
        mimeType: file.mimeType || "application/octet-stream",
        data: file.buffer.toString("base64"),
      },
    }));

    const prompt = buildPrompt({ courseName, description });
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
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }, ...fileParts],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return json(res, 500, { error: "Gemini API error", detail: text });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    const parsed = parseJsonSafe(text);
    if (!parsed) {
      return json(res, 502, { error: "Model did not return valid JSON", detail: text.slice(0, 400) });
    }

    const supabase = getUserClient(user.accessToken);
    const now = new Date().toISOString();

    let finalCourseId = courseId;
    if (courseId) {
      const { error } = await supabase
        .from("courses")
        .update({
          name: courseName,
          type: courseType,
          description: description || "",
          extra_notes: extraNotes || "",
          updated_at: now,
        })
        .eq("id", courseId)
        .eq("user_id", user.id);

      if (error) return json(res, 500, { error: error.message });

      await supabase.from("materials").delete().eq("course_id", courseId);
    } else {
      const { data: created, error } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          name: courseName,
          type: courseType,
          description: description || "",
          extra_notes: extraNotes || "",
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) return json(res, 500, { error: error.message });
      finalCourseId = created.id;
    }

    if (files.length) {
      const uploads = files.map(async (file) => {
        const path = `${user.id}/${finalCourseId}/${Date.now()}-${file.filename}`;
        const { error: uploadError } = await supabase.storage
          .from("course-files")
          .upload(path, file.buffer, {
            contentType: file.mimeType || "application/octet-stream",
            upsert: false,
          });
        if (uploadError) return { ok: false, error: uploadError.message };

        return {
          ok: true,
          record: {
            course_id: finalCourseId,
            name: file.filename,
            type: file.mimeType || "unknown",
            kind: "binary",
            content: path,
            created_at: now,
          },
        };
      });

      const results = await Promise.all(uploads);
      const rows = results.filter((r) => r.ok).map((r) => r.record);
      if (rows.length) {
        await supabase.from("materials").insert(rows);
      }
    }

    await supabase.from("guides").insert({
      course_id: finalCourseId,
      raw_text: text,
      json_text: JSON.stringify(parsed),
      created_at: now,
    });

    return json(res, 200, { raw: text, courseId: finalCourseId });
  } catch (err) {
    return json(res, 500, { error: "Server error", detail: err.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
