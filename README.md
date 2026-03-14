# StudySprint (Gemini-powered)

A web app that signs in a student, collects course details + files, and calls the Gemini API to generate slide-style lessons with step quizzes. Built for Vercel serverless using Supabase.

## Vercel deployment (serverless)
1. Create a Supabase project.
2. Run the SQL in `supabase.sql` to create tables, RLS policies, and storage bucket.
3. Set Vercel environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_JWT_SECRET`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional)
4. Deploy to Vercel.

## Health check
- `GET /api/health` verifies Supabase + Gemini.

## Pages
- Home: `/index.html`
- Sign up: `/signup.html`
- Sign in: `/signin.html`
- Dashboard: `/dashboard.html`
- Course builder: `/course.html`
- Lesson player: `/lesson.html?id=COURSE_ID`
- Final quiz: `/final.html?id=COURSE_ID`

## Notes
- File uploads are sent to Gemini and stored in Supabase Storage (`course-files`).
- Quizzes are graded by Gemini via `/api/grade`.
- Final quiz can be regenerated multiple times.
