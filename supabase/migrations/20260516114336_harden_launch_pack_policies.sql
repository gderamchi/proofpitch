drop policy if exists "members can manage launch packs" on public.launch_packs;
drop policy if exists "members can read launch packs" on public.launch_packs;
drop policy if exists "members can write launch packs" on public.launch_packs;

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
