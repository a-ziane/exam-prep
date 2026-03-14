# StudySprint (Gemini-powered)

A web app that signs in a student, collects course details + files, and calls the Gemini API to generate slide-style lessons with step quizzes, a final quiz, and an evaluation rubric. Includes real auth, SQLite persistence, progress tracking, and file attachments sent directly to Gemini.

## Quick start
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values.
3. Run the server: `npm run dev`
4. Open `http://localhost:3000/index.html`

## Pages
- Home: `/index.html`
- Sign up: `/signup.html`
- Sign in: `/signin.html`
- Dashboard: `/dashboard.html`
- Course builder: `/course.html`
- Lesson player: `/lesson.html?id=COURSE_ID`
- Final quiz: `/final.html?id=COURSE_ID`

## Environment variables
- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional, default `gemini-2.5-flash`)
- `GEMINI_MAX_TOKENS` (optional, default `8192`)
- `SESSION_SECRET` (required for production)
- `DB_PATH` (optional, default `./data/app.db`)

## Notes
- Uploaded files are sent directly to Gemini as attachments, no local parsing.
- The lesson player presents one slide at a time, then a quiz before continuing.
- Progress is saved per course and resumes at the last slide/quiz.
