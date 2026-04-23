# Gor LMS

A simple Learning Management System with an AI coach, built with Next.js + Supabase.

---

## First-time setup (do this once)

### 1. Install Node.js
Download from https://nodejs.org — choose the LTS version.

### 2. Create a Supabase project
1. Go to https://supabase.com → Sign up → New project
2. Remember your database password
3. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abc123.supabase.co`)
   - **anon public** key

### 3. Set up the database
1. In Supabase, go to **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

### 4. Configure environment variables
1. Copy `.env.local.example` → `.env.local`
2. Fill in your Supabase URL, anon key, and OpenAI API key
   - OpenAI key: https://platform.openai.com/api-keys

### 5. Install and run locally
Open Terminal in this folder and run:
```bash
npm install
npm run dev
```
Then open http://localhost:3000 in your browser.

---

## Make yourself an admin
1. Sign up at http://localhost:3000/auth/signup
2. Go to Supabase → **Authentication → Users** → copy your User UID
3. Go to **SQL Editor** and run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'paste-your-uid-here';
   ```
4. Sign out and sign back in — you'll land on the Admin Dashboard

---

## Deploy to production (Vercel)
1. Push this folder to a GitHub repository
2. Go to https://vercel.com → New Project → import your repo
3. Add your environment variables (same as `.env.local`) in Vercel's Settings
4. Deploy — Vercel auto-deploys on every git push

---

## Folder structure
```
app/
  admin/       Admin pages (dashboard, courses, lessons)
  learn/       Learner pages (courses, lessons, progress)
  auth/        Login and signup pages
  api/         Backend API routes (AI coach, etc.)
components/    Shared UI pieces
lib/supabase/  Database connection helpers
supabase/      Database schema SQL
```

---

## Security notes (review before sharing publicly)
- All database tables have Row Level Security (RLS) enabled
- API keys are in `.env.local` — never commit this file
- Production: enable email confirmation in Supabase Auth settings
- Production: set up a custom domain in Vercel
