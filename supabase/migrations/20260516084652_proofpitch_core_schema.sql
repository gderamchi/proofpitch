create extension if not exists pgcrypto;

do $$
begin
  create type public.proofpitch_plan as enum ('free', 'founder', 'pro', 'agency', 'enterprise');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.pitch_pack_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.launch_pack_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan public.proofpitch_plan not null default 'free',
  billing_mode text not null default 'manual',
  single_pack_credits integer not null default 0 check (single_pack_credits >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  default_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  status public.pitch_pack_status not null default 'completed',
  plan public.proofpitch_plan not null default 'free',
  quota jsonb not null default '{}'::jsonb,
  input_text text not null,
  project_url text,
  output_json jsonb not null,
  approval_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.launch_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_url text not null,
  product_name text not null,
  target_audience text not null,
  launch_goal text not null,
  status public.launch_pack_status not null default 'completed',
  output_json jsonb not null,
  video_url text,
  screenshots jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  pitch_pack_id uuid references public.pitch_packs(id) on delete cascade,
  type text not null check (type in ('user_input', 'web', 'repo', 'upload')),
  title text not null,
  url text,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  pitch_pack_id uuid not null references public.pitch_packs(id) on delete cascade,
  text text not null,
  status text not null check (status in ('supported', 'weak', 'unsupported', 'user_provided')),
  source_type text not null check (source_type in ('user_input', 'web', 'repo', 'inference')),
  source_title text,
  source_url text,
  explanation text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_runs (
  id uuid primary key default gen_random_uuid(),
  pitch_pack_id uuid not null references public.pitch_packs(id) on delete cascade,
  provider text not null check (provider in ('openai', 'tavily', 'pioneer')),
  status text not null check (status in ('used', 'missing', 'failed', 'fallback', 'pending')),
  latency_ms integer,
  estimated_cost_cents numeric(10, 4),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  pitch_pack_id uuid not null references public.pitch_packs(id) on delete cascade,
  type text not null check (type in ('markdown', 'pdf')),
  storage_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  pack_count integer not null default 0 check (pack_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, period_start)
);

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.organizations,
  public.organization_members,
  public.projects,
  public.pitch_packs,
  public.launch_packs,
  public.source_documents,
  public.claims,
  public.provider_runs,
  public.exports,
  public.usage_counters
to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists pitch_packs_set_updated_at on public.pitch_packs;
create trigger pitch_packs_set_updated_at before update on public.pitch_packs
for each row execute function public.set_updated_at();

drop trigger if exists launch_packs_set_updated_at on public.launch_packs;
create trigger launch_packs_set_updated_at before update on public.launch_packs
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.pitch_packs enable row level security;
alter table public.launch_packs enable row level security;
alter table public.source_documents enable row level security;
alter table public.claims enable row level security;
alter table public.provider_runs enable row level security;
alter table public.exports enable row level security;
alter table public.usage_counters enable row level security;

drop policy if exists "members can read their organizations" on public.organizations;
create policy "members can read their organizations"
on public.organizations for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  )
);

drop policy if exists "owners and admins can update organizations" on public.organizations;
create policy "owners and admins can update organizations"
on public.organizations for update to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
);

drop policy if exists "users can read their own memberships" on public.organization_members;
create policy "users can read their own memberships"
on public.organization_members for select to authenticated
using (user_id = auth.uid());

drop policy if exists "members can read projects" on public.projects;
create policy "members can read projects"
on public.projects for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = projects.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write projects" on public.projects;
create policy "members can write projects"
on public.projects for all to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = projects.organization_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = projects.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read pitch packs" on public.pitch_packs;
create policy "members can read pitch packs"
on public.pitch_packs for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = pitch_packs.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write pitch packs" on public.pitch_packs;
create policy "members can write pitch packs"
on public.pitch_packs for all to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = pitch_packs.organization_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = pitch_packs.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read launch packs" on public.launch_packs;
create policy "members can read launch packs"
on public.launch_packs for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = launch_packs.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write launch packs" on public.launch_packs;
create policy "members can write launch packs"
on public.launch_packs for all to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = launch_packs.organization_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = launch_packs.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read source documents" on public.source_documents;
create policy "members can read source documents"
on public.source_documents for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = source_documents.organization_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read claims" on public.claims;
create policy "members can read claims"
on public.claims for select to authenticated
using (
  exists (
    select 1
    from public.pitch_packs p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = claims.pitch_pack_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read provider runs" on public.provider_runs;
create policy "members can read provider runs"
on public.provider_runs for select to authenticated
using (
  exists (
    select 1
    from public.pitch_packs p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = provider_runs.pitch_pack_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read exports" on public.exports;
create policy "members can read exports"
on public.exports for select to authenticated
using (
  exists (
    select 1
    from public.pitch_packs p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = exports.pitch_pack_id and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read usage counters" on public.usage_counters;
create policy "members can read usage counters"
on public.usage_counters for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = usage_counters.organization_id and m.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('proofpitch-exports', 'proofpitch-exports', false)
on conflict (id) do nothing;
