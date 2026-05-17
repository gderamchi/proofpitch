do $$
begin
  create type public.demo_video_project_status as enum ('queued', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.demo_video_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_url text not null,
  product_name text not null,
  target_audience text not null,
  demo_goal text not null,
  status public.demo_video_project_status not null default 'running',
  output_json jsonb not null,
  video_url text,
  voiceover_url text,
  screenshots jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists demo_video_projects_set_updated_at on public.demo_video_projects;
create trigger demo_video_projects_set_updated_at
before update on public.demo_video_projects
for each row execute function public.set_updated_at();

alter table public.demo_video_projects enable row level security;

grant select, insert, update, delete on public.demo_video_projects to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "members can read demo video projects" on public.demo_video_projects;
create policy "members can read demo video projects"
on public.demo_video_projects for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = demo_video_projects.organization_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "members can write demo video projects" on public.demo_video_projects;
create policy "members can write demo video projects"
on public.demo_video_projects for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = demo_video_projects.organization_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = demo_video_projects.organization_id
      and m.user_id = auth.uid()
  )
);

drop table if exists public.exports;
drop table if exists public.provider_runs;
drop table if exists public.claims;
drop table if exists public.source_documents;
drop table if exists public.pitch_packs;
drop table if exists public.projects;
drop table if exists public.usage_counters;
drop table if exists public.channel_drafts;
drop table if exists public.launch_packs;

drop type if exists public.pitch_pack_status;
drop type if exists public.launch_pack_status;
drop type if exists public.channel_draft_status;
