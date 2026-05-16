do $$
begin
  create type public.launch_pack_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

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

create table if not exists public.channel_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  launch_pack_id uuid not null references public.launch_packs(id) on delete cascade,
  channel text not null check (channel in ('product_hunt', 'youtube', 'linkedin', 'x')),
  payload jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending_review' check (review_status in ('pending_review', 'reviewed')),
  publish_status text not null default 'pending_review' check (publish_status in ('pending_review', 'ready_to_publish', 'published', 'failed', 'connection_required', 'manual_handoff')),
  safe_autofill_url text,
  autofill_token text,
  external_id text,
  external_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('youtube', 'linkedin', 'x')),
  status text not null default 'pending' check (status in ('pending', 'connected', 'revoked', 'failed')),
  encrypted_access_token text,
  encrypted_refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, provider)
);

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.launch_packs,
  public.channel_drafts,
  public.social_connections
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

drop trigger if exists launch_packs_set_updated_at on public.launch_packs;
create trigger launch_packs_set_updated_at
before update on public.launch_packs
for each row execute function public.set_updated_at();

drop trigger if exists channel_drafts_set_updated_at on public.channel_drafts;
create trigger channel_drafts_set_updated_at
before update on public.channel_drafts
for each row execute function public.set_updated_at();

drop trigger if exists social_connections_set_updated_at on public.social_connections;
create trigger social_connections_set_updated_at
before update on public.social_connections
for each row execute function public.set_updated_at();

alter table public.launch_packs enable row level security;
alter table public.channel_drafts enable row level security;
alter table public.social_connections enable row level security;

drop policy if exists "members can read launch packs" on public.launch_packs;
create policy "members can read launch packs"
on public.launch_packs for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = launch_packs.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write launch packs" on public.launch_packs;
create policy "members can write launch packs"
on public.launch_packs for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = launch_packs.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = launch_packs.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read channel drafts" on public.channel_drafts;
create policy "members can read channel drafts"
on public.channel_drafts for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = channel_drafts.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write channel drafts" on public.channel_drafts;
create policy "members can write channel drafts"
on public.channel_drafts for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = channel_drafts.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = channel_drafts.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can read social connections" on public.social_connections;
create policy "members can read social connections"
on public.social_connections for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write own social connections" on public.social_connections;
create policy "members can write own social connections"
on public.social_connections for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = auth.uid()
  )
);
