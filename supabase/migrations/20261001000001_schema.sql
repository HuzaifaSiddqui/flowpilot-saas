-- FlowPilot — 0001 schema
-- Tables, enums, constraints and indexes. Security lives in 0002, business logic in 0003.


create type public.workspace_role  as enum ('owner', 'admin', 'member');
create type public.project_status  as enum ('active', 'on_hold', 'completed', 'archived');
create type public.task_status     as enum ('todo', 'in_progress', 'review', 'done');
create type public.task_priority   as enum ('low', 'medium', 'high', 'urgent');
create type public.plan_tier       as enum ('free', 'pro', 'team');

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── workspaces ──────────────────────────────────────────────────────────
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  owner_id    uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,   -- → profiles lets PostgREST embed member names
  role         public.workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  role         public.workspace_role not null default 'member' check (role <> 'owner'),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  unique (workspace_id, email)
);

-- ── clients / projects / tasks (every row carries workspace_id) ─────────
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  email        text check (email is null or position('@' in email) > 1),
  company      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id)               -- target for same-workspace composite FKs
);

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id    uuid,
  name         text not null check (char_length(name) between 1 and 120),
  description  text,
  status       public.project_status not null default 'active',
  due_date     date,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, workspace_id),
  -- a project may only reference a client from the SAME workspace
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id)
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id   uuid not null,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  status       public.task_status not null default 'todo',
  priority     public.task_priority not null default 'medium',
  due_date     date,
  assigned_to  uuid,
  position     integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- a task may only belong to a project of the SAME workspace
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade,
  -- an assignee must be a member of the SAME workspace
  foreign key (workspace_id, assigned_to) references public.workspace_members (workspace_id, user_id)
    on delete set null (assigned_to)
);

-- ── billing (writable ONLY by trusted backend code) ─────────────────────
create table public.subscriptions (
  workspace_id           uuid primary key references public.workspaces (id) on delete cascade,
  plan                   public.plan_tier not null default 'free',
  status                 text not null default 'active',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

create table public.stripe_events (
  stripe_event_id text primary key,                   -- idempotency key
  event_type      text not null,
  processed_at    timestamptz not null default now()
);

create table public.plan_limits (
  plan         public.plan_tier primary key,
  max_projects integer,                               -- null = unlimited
  max_seats    integer not null
);
insert into public.plan_limits values ('free', 2, 2), ('pro', null, 5), ('team', null, 10);

create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  entity_name  text,
  created_at   timestamptz not null default now()
);

-- ── indexes (policies filter on these columns) ──────────────────────────
create index workspace_members_user_idx   on public.workspace_members (user_id);
create index invitations_email_idx        on public.workspace_invitations (email);
create index clients_workspace_idx        on public.clients (workspace_id);
create index projects_workspace_idx       on public.projects (workspace_id, status);
create index projects_client_idx          on public.projects (client_id);
create index tasks_workspace_idx          on public.tasks (workspace_id);
create index tasks_project_idx            on public.tasks (project_id, status, position);
create index tasks_assignee_idx           on public.tasks (assigned_to);
create index activity_workspace_idx       on public.activity_logs (workspace_id, created_at desc);

-- ── updated_at maintenance ──────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger touch_profiles   before update on public.profiles   for each row execute function public.touch_updated_at();
create trigger touch_workspaces before update on public.workspaces for each row execute function public.touch_updated_at();
create trigger touch_clients    before update on public.clients    for each row execute function public.touch_updated_at();
create trigger touch_projects   before update on public.projects   for each row execute function public.touch_updated_at();
create trigger touch_tasks      before update on public.tasks      for each row execute function public.touch_updated_at();

-- ── workspace_id is immutable (blocks "move a row into another tenant") ─
create or replace function public.prevent_workspace_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger immutable_ws_clients  before update on public.clients  for each row execute function public.prevent_workspace_change();
create trigger immutable_ws_projects before update on public.projects for each row execute function public.prevent_workspace_change();
create trigger immutable_ws_tasks    before update on public.tasks    for each row execute function public.prevent_workspace_change();
