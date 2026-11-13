-- =====================================================================
-- Team Hub · batch 1 (13 Nov 2026): repeating tasks, review step, on leave, task templates
-- Paste into Supabase → SQL Editor → New query → Run, BEFORE the new app version goes live.
-- Safe to re-run. Only adds things: no table is dropped, no existing row is changed or removed.
-- The same changes are in schema.sql.
-- =====================================================================

-- ---------- on leave: dates on each person ----------
alter table employees add column if not exists away_from date;
alter table employees add column if not exists away_to   date;
alter table employees add column if not exists away_note text not null default '';

-- ---------- tasks: repeating marker + reviewer ----------
alter table tasks add column if not exists repeat_rule_id text;
alter table tasks add column if not exists reviewer_id    text references employees(id) on delete set null;

-- ---------- review step: allow the new status 'review' ----------
-- tasks.status is plain text with a CHECK constraint (no enum). Replace whatever status check
-- exists with one that also allows 'review'. Every existing row already passes the new check.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.tasks'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table tasks drop constraint %I', c.conname);
  end loop;
  alter table tasks add constraint tasks_status_check check (status in ('todo', 'doing', 'review', 'waiting', 'done'));
end $$;

-- ---------- new tables ----------
create table if not exists repeat_rules (
  id          text primary key,
  title       text not null,                                   -- may use {client} and {service}
  scope       text not null default 'service' check (scope in ('service', 'client', 'none')),
  services    text[] not null default '{}',
  client_id   text references clients(id) on delete cascade,
  assign      text not null default 'service' check (assign in ('service', 'owner', 'person')),
  person_id   text references employees(id) on delete set null,
  freq        text not null default 'monthly' check (freq in ('monthly', 'weekly')),
  day         int  not null default 1,                         -- monthly: day of month · weekly: 1 = Monday … 7 = Sunday
  due_day     int  not null default 1,                         -- monthly only
  active      boolean not null default true,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists repeat_runs (
  id       text primary key,                                   -- same as the task id
  rule_id  text,
  at       bigint not null
);
create index if not exists repeat_runs_at_idx on repeat_runs (at);

create table if not exists task_templates (
  id          text primary key,
  name        text not null,
  items       jsonb not null default '[]'::jsonb,              -- [{ title, assign, service, personId, days }]
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- ---------- leave dates: self, own head, or admin ----------
create or replace function set_away(target text, from_date date, to_date date, note text default '')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (target = me_id() or is_admin() or leads(target)) then
    raise exception 'You can only set leave for yourself or your team';
  end if;
  update employees
     set away_from = from_date, away_to = to_date, away_note = coalesce(note, '')
   where id = target;
end $$;
grant execute on function set_away(text, date, date, text) to authenticated;

-- ---------- row level security ----------
alter table repeat_rules   enable row level security;
alter table repeat_runs    enable row level security;
alter table task_templates enable row level security;

drop policy if exists "team reads rules"        on repeat_rules;
drop policy if exists "admin adds rules"        on repeat_rules;
drop policy if exists "admin edits rules"       on repeat_rules;
drop policy if exists "admin removes rules"     on repeat_rules;
drop policy if exists "team reads templates"    on task_templates;
drop policy if exists "admin adds templates"    on task_templates;
drop policy if exists "admin edits templates"   on task_templates;
drop policy if exists "admin removes templates" on task_templates;
drop policy if exists "team reads runs"         on repeat_runs;
drop policy if exists "team adds runs"          on repeat_runs;
drop policy if exists "admin removes runs"      on repeat_runs;

-- rules and templates: everyone reads; only the admin changes them
create policy "team reads rules"     on repeat_rules for select using (is_member());
create policy "admin adds rules"     on repeat_rules for insert with check (is_admin());
create policy "admin edits rules"    on repeat_rules for update using (is_admin()) with check (is_admin());
create policy "admin removes rules"  on repeat_rules for delete using (is_admin());
create policy "team reads templates"    on task_templates for select using (is_member());
create policy "admin adds templates"    on task_templates for insert with check (is_admin());
create policy "admin edits templates"   on task_templates for update using (is_admin()) with check (is_admin());
create policy "admin removes templates" on task_templates for delete using (is_admin());
-- record of repeating tasks already made: anyone on the team adds; the admin can clear
create policy "team reads runs"      on repeat_runs for select using (is_member());
create policy "team adds runs"       on repeat_runs for insert with check (is_member());
create policy "admin removes runs"   on repeat_runs for delete using (is_admin());

-- repeating tasks are made by whoever opens Team Hub first; "given by" is the department head,
-- so they need their own insert rule (the usual one requires "given by" = you)
drop policy if exists "team adds repeating tasks" on tasks;
create policy "team adds repeating tasks" on tasks for insert
  with check (is_member() and id like 'T-R-%'
              and exists (select 1 from repeat_rules r where r.id = repeat_rule_id and r.active));

-- ---------- live updates: add the new tables if the others are already published ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    foreach t in array array['repeat_rules', 'repeat_runs', 'task_templates'] loop
      begin
        execute format('alter publication supabase_realtime add table %I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- ---------- default repeating tasks and starter templates (only if missing) ----------
insert into repeat_rules (id, title, scope, services, client_id, assign, person_id, freq, day, due_day, active, created_at) values
  ('R-1', 'Monthly {service} report — {client}', 'service', array['Social Media', 'Performance Marketing', 'SEO']::text[], null, 'service', null, 'monthly', 1, 5, true, 1794540600000),
  ('R-2', 'Weekly PPC report — {client}', 'service', array['Performance Marketing']::text[], null, 'service', null, 'weekly', 1, 1, true, 1794540600000)
on conflict (id) do nothing;

insert into task_templates (id, name, created_at, items) values
  ('TPL-1', 'New social media client', 1794540600000, '[{"title":"Kick-off call and brand questionnaire","assign":"owner","service":null,"personId":null,"days":1},{"title":"Collect page logins, brand kit and assets","assign":"owner","service":null,"personId":null,"days":2},{"title":"Competitor and audience research","assign":"service","service":"Social Media","personId":null,"days":4},{"title":"Content pillars and tone of voice","assign":"service","service":"Social Media","personId":null,"days":5},{"title":"Profile, cover and highlight refresh","assign":"service","service":"Creative","personId":null,"days":6},{"title":"First month content calendar","assign":"service","service":"Social Media","personId":null,"days":7},{"title":"Send content calendar for client approval","assign":"owner","service":null,"personId":null,"days":8}]'::jsonb),
  ('TPL-2', 'New PPC client', 1794540600000, '[{"title":"Get ad account and Business Manager access","assign":"service","service":"Performance Marketing","personId":null,"days":1},{"title":"Set up pixel and conversion tracking","assign":"service","service":"Performance Marketing","personId":null,"days":3},{"title":"Keyword and audience research","assign":"service","service":"Performance Marketing","personId":null,"days":4},{"title":"Campaign structure and budget plan","assign":"service","service":"Performance Marketing","personId":null,"days":5},{"title":"Ad copy and creative brief","assign":"service","service":"Performance Marketing","personId":null,"days":6},{"title":"Ad creatives","assign":"service","service":"Creative","personId":null,"days":8},{"title":"Launch campaigns and check tracking","assign":"service","service":"Performance Marketing","personId":null,"days":10}]'::jsonb),
  ('TPL-3', 'New SEO client', 1794540600000, '[{"title":"Get Search Console, Analytics and website access","assign":"service","service":"SEO","personId":null,"days":1},{"title":"Technical site audit","assign":"service","service":"SEO","personId":null,"days":4},{"title":"Keyword research and target pages","assign":"service","service":"SEO","personId":null,"days":6},{"title":"Competitor backlink check","assign":"service","service":"SEO","personId":null,"days":7},{"title":"On-page fixes list for the website","assign":"service","service":"SEO","personId":null,"days":9},{"title":"Share the 3-month SEO plan with the client","assign":"owner","service":null,"personId":null,"days":10}]'::jsonb)
on conflict (id) do nothing;
