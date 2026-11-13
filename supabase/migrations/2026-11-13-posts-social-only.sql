-- =====================================================================
-- Team Hub · post calendar is for the Social Media team (and the admin) only
-- Paste into Supabase → SQL Editor → New query → Run.
-- Safe to re-run. Same change as in schema.sql.
-- =====================================================================

-- true if the signed-in person may use the post calendar: the admin or the Social Media team
-- (me_id() only matches active employees)
create or replace function can_see_posts() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = me_id() and (role = 'admin' or department = 'Social Media'))
$$;

alter table posts enable row level security;

-- old rules: anyone on the team
drop policy if exists "team reads posts"   on posts;
drop policy if exists "team adds posts"    on posts;
drop policy if exists "team edits posts"   on posts;
drop policy if exists "team removes posts" on posts;

-- new rules
drop policy if exists "social reads posts"   on posts;
drop policy if exists "social adds posts"    on posts;
drop policy if exists "social edits posts"   on posts;
drop policy if exists "social removes posts" on posts;
create policy "social reads posts"   on posts for select using (can_see_posts());
create policy "social adds posts"    on posts for insert with check (can_see_posts());
create policy "social edits posts"   on posts for update using (can_see_posts()) with check (can_see_posts());
create policy "social removes posts" on posts for delete using (can_see_posts());
