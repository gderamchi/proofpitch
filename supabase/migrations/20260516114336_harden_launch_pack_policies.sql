create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "members can read launch packs" on public.launch_packs;
drop policy if exists "members can write launch packs" on public.launch_packs;
drop policy if exists "members can manage launch packs" on public.launch_packs;
create policy "members can manage launch packs"
on public.launch_packs for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = launch_packs.organization_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = launch_packs.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "members can read channel drafts" on public.channel_drafts;
drop policy if exists "members can write channel drafts" on public.channel_drafts;
drop policy if exists "members can manage channel drafts" on public.channel_drafts;
create policy "members can manage channel drafts"
on public.channel_drafts for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = channel_drafts.organization_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = channel_drafts.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "members can read social connections" on public.social_connections;
drop policy if exists "members can write own social connections" on public.social_connections;
drop policy if exists "members can insert own social connections" on public.social_connections;
drop policy if exists "members can update own social connections" on public.social_connections;
drop policy if exists "members can delete own social connections" on public.social_connections;
create policy "members can read social connections"
on public.social_connections for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = (select auth.uid())
  )
);

create policy "members can insert own social connections"
on public.social_connections for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = (select auth.uid())
  )
);

create policy "members can update own social connections"
on public.social_connections for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = (select auth.uid())
  )
);

create policy "members can delete own social connections"
on public.social_connections for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.organization_members m
    where m.organization_id = social_connections.organization_id
      and m.user_id = (select auth.uid())
  )
);
