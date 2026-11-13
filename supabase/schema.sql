-- =====================================================================
-- Team Hub · shared database
-- Run this once in Supabase → SQL Editor → New query → paste → Run.
-- Then run seed.sql the same way to load the team, clients and current work.
-- Safe to re-run: it only creates what is missing and replaces the rules.
-- =====================================================================

create table if not exists employees (
  id          text primary key,
  name        text not null,
  title       text not null default '',
  department  text not null default '',
  role        text not null default 'member' check (role in ('admin', 'head', 'member')),
  head_id     text references employees(id) on delete set null,
  email       text unique,
  phone       text not null default '',
  color       text not null default '#5d626c',
  active      boolean not null default true,
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists clients (
  id           text primary key,
  name         text not null,
  services     text[] not null default '{}',
  owner_id     text references employees(id) on delete set null,
  member_ids   text[] not null default '{}',
  deliverables text not null default '',
  ads          text not null default '',
  brief        text not null default '',
  color        text not null default '#2F80ED',
  active       boolean not null default true,
  created_at   bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists tasks (
  id              text primary key,
  title           text not null,
  client_id       text references clients(id) on delete set null,
  assignee_id     text references employees(id),
  assigned_by_id  text references employees(id),
  due             date,
  status          text not null default 'todo' check (status in ('todo', 'doing', 'waiting', 'done')),
  urgent          boolean not null default false,
  notes           text not null default '',
  links           text[] not null default '{}',
  created_at      bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at      bigint,
  completed_at    bigint
);

create table if not exists comments (
  id         text primary key,
  task_id    text not null references tasks(id) on delete cascade,
  author_id  text references employees(id),
  text       text not null,
  at         bigint not null
);

-- one line per person, per client, per day (the old master tracker)
create table if not exists updates (
  id           text primary key,
  employee_id  text not null references employees(id),
  client_id    text references clients(id) on delete cascade,
  date         date not null,
  text         text not null,
  at           bigint not null
);

-- the post calendar (the old post tracker)
create table if not exists posts (
  id          text primary key,
  client_id   text not null references clients(id) on delete cascade,
  date        date not null,
  kind        text not null default 'Post',
  status      text not null default 'not_ready' check (status in ('not_ready', 'ready', 'scheduled', 'posted')),
  note        text not null default '',
  created_by  text references employees(id) on delete set null,
  at          bigint not null
);

-- notifications feed inside the app
create table if not exists activity (
  id         text primary key,
  at         bigint not null,
  actor_id   text,
  type       text,
  text       text,
  task_id    text,
  client_id  text,
  target_id  text
);

create index if not exists tasks_assignee_idx on tasks (assignee_id);
create index if not exists tasks_client_idx on tasks (client_id);
create index if not exists updates_date_idx on updates (date);
create index if not exists posts_date_idx on posts (date);
create index if not exists activity_at_idx on activity (at desc);

-- ---------------------------------------------------------------------
-- Who is signed in?  (matches the sign-in email to an active employee)
-- ---------------------------------------------------------------------
create or replace function me_id() returns text
language sql stable security definer set search_path = public as $$
  select id from employees
  where lower(email) = lower(auth.jwt() ->> 'email') and active
  limit 1
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$ select me_id() is not null $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = me_id() and role = 'admin')
$$;

create or replace function is_lead() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = me_id() and role in ('admin', 'head'))
$$;

-- true if the signed-in person is the head of `target` (directly or further up)
create or replace function leads(target text) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, head_id from employees where id = target
    union
    select e.id, e.head_id from employees e join chain c on e.id = c.head_id
  )
  select exists (select 1 from chain where head_id = me_id())
$$;

-- true if the signed-in person may use the post calendar: the admin or the Social Media team
create or replace function can_see_posts() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = me_id() and (role = 'admin' or department = 'Social Media'))
$$;

-- ---------------------------------------------------------------------
-- Only people on the team list can create an account
-- ---------------------------------------------------------------------
create or replace function public.guard_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.employees where lower(email) = lower(new.email) and active) then
    raise exception 'This email is not on the Team Hub list';
  end if;
  return new;
end $$;

drop trigger if exists guard_signup on auth.users;
create trigger guard_signup before insert on auth.users
  for each row execute function public.guard_signup();

-- ---------------------------------------------------------------------
-- Row level security: nobody outside the team can read or write anything
-- ---------------------------------------------------------------------
alter table employees enable row level security;
alter table clients   enable row level security;
alter table tasks     enable row level security;
alter table comments  enable row level security;
alter table updates   enable row level security;
alter table posts     enable row level security;
alter table activity  enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('employees','clients','tasks','comments','updates','posts','activity')
  loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- people: everyone on the team can see; only the admin edits
create policy "team reads people"    on employees for select using (is_member());
create policy "admin adds people"    on employees for insert with check (is_admin());
create policy "admin edits people"   on employees for update using (is_admin()) with check (is_admin());
create policy "admin removes people" on employees for delete using (is_admin());

-- clients: everyone sees; admin and heads add/edit; admin deletes
create policy "team reads clients"   on clients for select using (is_member());
create policy "leads add clients"    on clients for insert with check (is_lead());
create policy "leads edit clients"   on clients for update using (is_lead()) with check (is_lead());
create policy "admin removes clients" on clients for delete using (is_admin());

-- tasks: everyone sees and can create; edit if you do it, gave it, lead the person, or are admin
create policy "team reads tasks"   on tasks for select using (is_member());
create policy "team adds tasks"    on tasks for insert with check (is_member() and assigned_by_id = me_id());
create policy "owners edit tasks"  on tasks for update
  using (is_admin() or assignee_id = me_id() or assigned_by_id = me_id() or leads(assignee_id))
  with check (is_member());
create policy "giver deletes tasks" on tasks for delete using (is_admin() or assigned_by_id = me_id());

-- comments
create policy "team reads comments"  on comments for select using (is_member());
create policy "team adds comments"   on comments for insert with check (author_id = me_id());
create policy "author edits comments" on comments for update using (author_id = me_id());
create policy "author removes comments" on comments for delete using (author_id = me_id() or is_admin());

-- daily updates: everyone reads; you write your own (admin can fix any)
create policy "team reads updates"  on updates for select using (is_member());
create policy "own updates insert"  on updates for insert with check (employee_id = me_id() or is_admin());
create policy "own updates update"  on updates for update using (employee_id = me_id() or is_admin()) with check (employee_id = me_id() or is_admin());
create policy "own updates delete"  on updates for delete using (employee_id = me_id() or is_admin());

-- post calendar: only the Social Media team and the admin can see, plan and update posts
drop policy if exists "social reads posts"   on posts;
drop policy if exists "social adds posts"    on posts;
drop policy if exists "social edits posts"   on posts;
drop policy if exists "social removes posts" on posts;
create policy "social reads posts"   on posts for select using (can_see_posts());
create policy "social adds posts"    on posts for insert with check (can_see_posts());
create policy "social edits posts"   on posts for update using (can_see_posts()) with check (can_see_posts());
create policy "social removes posts" on posts for delete using (can_see_posts());

-- activity feed
create policy "team reads activity" on activity for select using (is_member());
create policy "team logs activity"  on activity for insert with check (actor_id = me_id());

-- ---------------------------------------------------------------------
-- Live updates for everyone's screen
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['employees','clients','tasks','comments','updates','posts','activity'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
