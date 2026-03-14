-- Run this in Supabase SQL editor

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null,
  description text,
  extra_notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  type text,
  kind text not null,
  content text,
  created_at timestamptz not null
);

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  raw_text text,
  json_text text,
  created_at timestamptz not null
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_index integer not null,
  status text not null,
  score numeric,
  stage text,
  slide_index integer,
  updated_at timestamptz not null,
  unique(course_id, lesson_index)
);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('course-files', 'course-files', false)
  on conflict (id) do nothing;

-- Enable RLS
alter table public.courses enable row level security;
alter table public.materials enable row level security;
alter table public.guides enable row level security;
alter table public.progress enable row level security;

-- RLS policies
create policy "courses_select" on public.courses
  for select using (auth.uid() = user_id);
create policy "courses_insert" on public.courses
  for insert with check (auth.uid() = user_id);
create policy "courses_update" on public.courses
  for update using (auth.uid() = user_id);
create policy "courses_delete" on public.courses
  for delete using (auth.uid() = user_id);

create policy "materials_select" on public.materials
  for select using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "materials_insert" on public.materials
  for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "materials_delete" on public.materials
  for delete using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );

create policy "guides_select" on public.guides
  for select using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "guides_insert" on public.guides
  for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "guides_update" on public.guides
  for update using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );

create policy "progress_select" on public.progress
  for select using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "progress_insert" on public.progress
  for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "progress_update" on public.progress
  for update using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );

-- Storage policies
create policy "course_files_read" on storage.objects
  for select using (bucket_id = 'course-files' and auth.uid() = owner);

create policy "course_files_write" on storage.objects
  for insert with check (bucket_id = 'course-files' and auth.uid() = owner);

create policy "course_files_delete" on storage.objects
  for delete using (bucket_id = 'course-files' and auth.uid() = owner);
