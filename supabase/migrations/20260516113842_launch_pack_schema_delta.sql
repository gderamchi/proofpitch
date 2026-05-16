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

drop trigger if exists launch_packs_set_updated_at on public.launch_packs;
create trigger launch_packs_set_updated_at
before update on public.launch_packs
for each row execute function public.set_updated_at();

alter table public.launch_packs enable row level security;

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
